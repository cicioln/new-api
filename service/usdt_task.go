package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

// 内置 USDT 收款的链上确认任务：只在主节点运行，定时关闭超时订单，并扫描有待支付订单的链上
// 转入记录，按"收款地址 + 精确金额 + 转账时间不早于下单"匹配订单后入账。

const (
	usdtTickInterval = 15 * time.Second

	// BSC USDT（BEP20）合约，18 位小数。
	usdtBscToken    = "0x55d398326f99059ff775485246999027b3197955"
	usdtBscDecimals = 18

	// Aptos 原生 USDt 为 fungible asset，6 位小数。
	usdtAptosDecimals = 6

	// BSC 首次扫描或游标丢失时回看的块数；每段最多扫描的块数与每轮最多扫描的段数。
	usdtBscLookback  = 1200
	usdtBscChunk     = 1000
	usdtBscMaxChunks = 10

	usdtTransferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
)

var (
	usdtTaskOnce    sync.Once
	usdtTaskRunning atomic.Bool
)

var usdtHTTPClient = &http.Client{Timeout: 15 * time.Second}

// usdtTransfer 是一笔转入收款地址的 USDT；Time 为秒级时间戳，EVM 链只有块号，匹配到订单后再查块时间。
type usdtTransfer struct {
	Id    string
	To    string
	Units int64
	Time  int64
	Block string
}

func StartUsdtPaymentTask() {
	usdtTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(usdtTickInterval)
			defer ticker.Stop()
			for range ticker.C {
				runUsdtPaymentOnce()
			}
		})
	})
}

func runUsdtPaymentOnce() {
	if !usdtTaskRunning.CompareAndSwap(false, true) {
		return
	}
	defer usdtTaskRunning.Store(false)

	ctx := context.Background()
	now := time.Now().Unix()
	if _, err := model.ExpireUsdtOrders(now); err != nil {
		logger.LogWarn(ctx, common.LogText("usdt expire orders failed: %v", err))
	}
	orders, err := model.GetPendingUsdtOrders(now)
	if err != nil {
		logger.LogWarn(ctx, common.LogText("usdt load pending orders failed: %v", err))
		return
	}
	byChain := map[string][]model.UsdtOrder{}
	for _, order := range orders {
		byChain[order.Chain] = append(byChain[order.Chain], order)
	}
	setting := operation_setting.GetPaymentSetting()
	for chain, chainOrders := range byChain {
		var transfers []usdtTransfer
		var scanErr error
		switch chain {
		case model.UsdtChainBsc:
			transfers, scanErr = scanBscTransfers(setting, chainOrders)
		case model.UsdtChainAptos:
			transfers, scanErr = scanAptosTransfers(setting, chainOrders)
		default:
			continue
		}
		if scanErr != nil {
			logger.LogWarn(ctx, common.LogText("usdt %s scan failed: %v", chain, scanErr))
		}
		for _, transfer := range transfers {
			settleUsdtTransfer(ctx, setting, chain, chainOrders, transfer)
		}
	}
}

// settleUsdtTransfer 把转账匹配到订单并入账。尾数分配保证同一地址上待支付订单的金额互不相同，
// 冷却期保证迟到的转账不会命中新订单，所以地址与金额一致即可确定订单。
func settleUsdtTransfer(ctx context.Context, setting *operation_setting.PaymentSetting, chain string, orders []model.UsdtOrder, transfer usdtTransfer) {
	var matched *model.UsdtOrder
	for i := range orders {
		if strings.EqualFold(orders[i].Address, transfer.To) && orders[i].PayUnits == transfer.Units {
			matched = &orders[i]
			break
		}
	}
	if matched == nil {
		return
	}
	transferTime := transfer.Time
	if transfer.Block != "" {
		var err error
		transferTime, err = bscBlockTime(setting, transfer.Block)
		if err != nil {
			logger.LogWarn(ctx, common.LogText("usdt bsc block time failed block=%s: %v", transfer.Block, err))
			return
		}
	}
	// 允许一分钟的时钟偏差。
	if transferTime < matched.CreateTime-60 {
		return
	}
	claimed, err := model.ClaimUsdtTransfer(matched.TradeNo, chain, transfer.Id, time.Now().Unix())
	if err != nil {
		logger.LogError(ctx, common.LogText("usdt claim transfer failed trade_no=%s tx=%s: %v", matched.TradeNo, transfer.Id, err))
		return
	}
	if !claimed {
		return
	}
	if _, err := model.RechargeOnlineTopUp(matched.TradeNo, model.PaymentProviderUsdt, "usdt", ""); err != nil {
		logger.LogError(ctx, common.LogText("usdt top-up credit failed trade_no=%s tx=%s: %v", matched.TradeNo, transfer.Id, err))
		return
	}
	logger.LogInfo(ctx, common.LogText("usdt order paid trade_no=%s chain=%s units=%d tx=%s", matched.TradeNo, chain, transfer.Units, transfer.Id))
}

// usdtUnits 把链上最小单位的金额换成 0.0001 USDT 单位，多余精度舍去。
func usdtUnits(value *big.Int, decimals int) int64 {
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals-4)), nil)
	return new(big.Int).Quo(value, divisor).Int64()
}

func usdtPost(url string, headers map[string]string, payload any, out any) error {
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := usdtHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return common.DecodeJson(resp.Body, out)
}

// ---- BSC ----

type evmRPCResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func bscRPC(setting *operation_setting.PaymentSetting, method string, params []any, out any) error {
	var resp evmRPCResponse
	payload := map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
	if err := usdtPost(strings.TrimSpace(setting.UsdtBscRpc), nil, payload, &resp); err != nil {
		return fmt.Errorf("%s: %w", method, err)
	}
	if resp.Error != nil {
		return fmt.Errorf("%s: %s", method, resp.Error.Message)
	}
	return common.Unmarshal(resp.Result, out)
}

func parseHexInt(hex string) (int64, error) {
	return strconv.ParseInt(strings.TrimPrefix(hex, "0x"), 16, 64)
}

func bscBlockTime(setting *operation_setting.PaymentSetting, block string) (int64, error) {
	var header struct {
		Timestamp string `json:"timestamp"`
	}
	if err := bscRPC(setting, "eth_getBlockByNumber", []any{block, false}, &header); err != nil {
		return 0, err
	}
	return parseHexInt(header.Timestamp)
}

func scanBscTransfers(setting *operation_setting.PaymentSetting, orders []model.UsdtOrder) ([]usdtTransfer, error) {
	var headHex string
	if err := bscRPC(setting, "eth_blockNumber", []any{}, &headHex); err != nil {
		return nil, err
	}
	head, err := parseHexInt(headHex)
	if err != nil {
		return nil, err
	}
	head -= int64(max(setting.UsdtBscConfirmations, 0))
	from := model.GetUsdtScanCursor(model.UsdtChainBsc)
	if from <= 0 || from < head-usdtBscLookback*20 {
		// 没有游标或停机过久：从最近的块开始，过久未扫描的订单由管理员手动补单。
		from = head - usdtBscLookback
	}

	topics := []string{}
	seen := map[string]bool{}
	for _, order := range orders {
		address := strings.ToLower(order.Address)
		if seen[address] {
			continue
		}
		seen[address] = true
		topics = append(topics, "0x"+strings.Repeat("0", 24)+strings.TrimPrefix(address, "0x"))
	}

	var transfers []usdtTransfer
	for i := 0; i < usdtBscMaxChunks && from <= head; i++ {
		to := min(from+usdtBscChunk-1, head)
		var logs []struct {
			Topics          []string `json:"topics"`
			Data            string   `json:"data"`
			TransactionHash string   `json:"transactionHash"`
			LogIndex        string   `json:"logIndex"`
			BlockNumber     string   `json:"blockNumber"`
		}
		filter := map[string]any{
			"fromBlock": fmt.Sprintf("0x%x", from),
			"toBlock":   fmt.Sprintf("0x%x", to),
			"address":   usdtBscToken,
			"topics":    []any{usdtTransferTopic, nil, topics},
		}
		if err := bscRPC(setting, "eth_getLogs", []any{filter}, &logs); err != nil {
			return transfers, err
		}
		for _, l := range logs {
			if len(l.Topics) < 3 || len(l.Topics[2]) < 42 {
				continue
			}
			value, ok := new(big.Int).SetString(strings.TrimPrefix(l.Data, "0x"), 16)
			if !ok {
				continue
			}
			logIndex, _ := parseHexInt(l.LogIndex)
			transfers = append(transfers, usdtTransfer{
				Id:    fmt.Sprintf("%s:%d", strings.ToLower(l.TransactionHash), logIndex),
				To:    "0x" + l.Topics[2][len(l.Topics[2])-40:],
				Units: usdtUnits(value, usdtBscDecimals),
				Block: l.BlockNumber,
			})
		}
		from = to + 1
		if err := model.SetUsdtScanCursor(model.UsdtChainBsc, from); err != nil {
			return transfers, err
		}
	}
	return transfers, nil
}

// ---- Aptos ----

const aptosDepositQuery = `query UsdtDeposits($owners: [String!], $asset: String!, $minVersion: bigint!, $since: timestamp!) {
  fungible_asset_activities(
    where: {
      owner_address: {_in: $owners}
      asset_type: {_eq: $asset}
      type: {_eq: "0x1::fungible_asset::Deposit"}
      is_transaction_success: {_eq: true}
      transaction_version: {_gt: $minVersion}
      transaction_timestamp: {_gte: $since}
    }
    order_by: {transaction_version: asc}
    limit: 200
  ) {
    transaction_version
    event_index
    owner_address
    amount
    transaction_timestamp
  }
}`

// NormalizeAptosAddress 把 Aptos 地址补齐为 0x + 64 位小写十六进制，与索引器返回的格式一致。
func NormalizeAptosAddress(address string) string {
	hex := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(address), "0x"))
	return "0x" + strings.Repeat("0", max(64-len(hex), 0)) + hex
}

func scanAptosTransfers(setting *operation_setting.PaymentSetting, orders []model.UsdtOrder) ([]usdtTransfer, error) {
	owners := []string{}
	seen := map[string]bool{}
	since := orders[0].CreateTime
	for _, order := range orders {
		since = min(since, order.CreateTime)
		if !seen[order.Address] {
			seen[order.Address] = true
			owners = append(owners, order.Address)
		}
	}
	headers := map[string]string{}
	if key := strings.TrimSpace(setting.UsdtAptosApiKey); key != "" {
		headers["Authorization"] = "Bearer " + key
	}
	payload := map[string]any{
		"query": aptosDepositQuery,
		"variables": map[string]any{
			"owners":     owners,
			"asset":      NormalizeAptosAddress(setting.UsdtAptosAsset),
			"minVersion": model.GetUsdtScanCursor(model.UsdtChainAptos),
			"since":      time.Unix(since-60, 0).UTC().Format("2006-01-02T15:04:05"),
		},
	}
	var resp struct {
		Data struct {
			Activities []struct {
				TransactionVersion json.Number `json:"transaction_version"`
				EventIndex         json.Number `json:"event_index"`
				OwnerAddress       string      `json:"owner_address"`
				Amount             json.Number `json:"amount"`
				TransactionTime    string      `json:"transaction_timestamp"`
			} `json:"fungible_asset_activities"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := usdtPost(strings.TrimSpace(setting.UsdtAptosIndexer), headers, payload, &resp); err != nil {
		return nil, err
	}
	if len(resp.Errors) > 0 {
		return nil, fmt.Errorf("aptos indexer: %s", resp.Errors[0].Message)
	}
	var transfers []usdtTransfer
	maxVersion := int64(0)
	for _, a := range resp.Data.Activities {
		version, err := a.TransactionVersion.Int64()
		if err != nil {
			continue
		}
		maxVersion = max(maxVersion, version)
		value, ok := new(big.Int).SetString(a.Amount.String(), 10)
		if !ok {
			continue
		}
		ts, err := time.Parse("2006-01-02T15:04:05", strings.SplitN(a.TransactionTime, ".", 2)[0])
		if err != nil {
			continue
		}
		transfers = append(transfers, usdtTransfer{
			Id:    fmt.Sprintf("%d:%s", version, a.EventIndex.String()),
			To:    a.OwnerAddress,
			Units: usdtUnits(value, usdtAptosDecimals),
			Time:  ts.Unix(),
		})
	}
	if maxVersion > 0 {
		if err := model.SetUsdtScanCursor(model.UsdtChainAptos, maxVersion); err != nil {
			return transfers, err
		}
	}
	return transfers, nil
}

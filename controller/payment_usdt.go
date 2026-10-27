package controller

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// 内置 USDT 收款：下单时分配本单唯一的转账金额，前端展示地址与二维码，service.StartUsdtPaymentTask
// 扫描链上转账确认到账。

const usdtOrderTimeout = 5 * 60

var (
	bscAddressPattern   = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	aptosAddressPattern = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)
	tronAddressPattern  = regexp.MustCompile(`^T[1-9A-HJ-NP-Za-km-z]{33}$`)
)

// usdtReceiver 是后台配置的一个收款地址。Name 由管理员填写，只用于展示；Chain 由地址格式推断，
// 决定由哪条链的扫描任务确认到账。
type usdtReceiver struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Chain   string `json:"chain"`
}

// usdtReceivers 返回可用的收款地址；格式无法识别的地址会被忽略。
func usdtReceivers() []usdtReceiver {
	setting := operation_setting.GetPaymentSetting()
	if !isPaymentComplianceConfirmed() || !setting.UsdtEnabled {
		return nil
	}
	receivers := []usdtReceiver{}
	for _, entry := range setting.UsdtAddresses {
		address := strings.TrimSpace(entry.Address)
		receiver := usdtReceiver{Name: strings.TrimSpace(entry.Name)}
		switch {
		case bscAddressPattern.MatchString(address):
			receiver.Chain = model.UsdtChainBsc
			receiver.Address = strings.ToLower(address)
		case aptosAddressPattern.MatchString(address):
			receiver.Chain = model.UsdtChainAptos
			receiver.Address = service.NormalizeAptosAddress(address)
		case tronAddressPattern.MatchString(address):
			// TRON Base58 地址区分大小写，原样保存。
			receiver.Chain = model.UsdtChainTron
			receiver.Address = address
		default:
			continue
		}
		if receiver.Name == "" {
			receiver.Name = "USDT"
		}
		receivers = append(receivers, receiver)
	}
	return receivers
}

func usdtOrderResponse(order *model.UsdtOrder) gin.H {
	return gin.H{
		"trade_no":   order.TradeNo,
		"chain":      order.Chain,
		"address":    order.Address,
		"pay_amount": decimal.NewFromInt(order.PayUnits).Div(decimal.NewFromInt(model.UsdtUnitsPerCoin)).StringFixed(4),
		"status":     order.Status,
		"expire_at":  order.ExpireAt,
	}
}

type UsdtPayRequest struct {
	Amount  int64  `json:"amount"`
	Address string `json:"address"`
}

func RequestUsdtPay(c *gin.Context) {
	var req UsdtPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	var receiver *usdtReceiver
	for _, item := range usdtReceivers() {
		if strings.EqualFold(item.Address, strings.TrimSpace(req.Address)) {
			receiver = &item
			break
		}
	}
	if receiver == nil {
		paymentError(c, common.NewMessage("Payment method does not exist"))
		return
	}
	if req.Amount < getMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getMinTopup()}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	now := time.Now().Unix()
	if order := model.FindReusableUsdtOrder(id, receiver.Chain, receiver.Address, amount, now); order != nil {
		common.ApiSuccess(c, usdtOrderResponse(order))
		return
	}

	// 应付金额是充值价格所用的本地货币（人民币），按 USDT 汇率换成 USDT；未设置时沿用站点美元汇率
	// （1 USDT = 1 美元）。充值折扣、分组倍率都已包含在应付金额里。向上取整到 0.01，
	// 再由 CreateUsdtOrder 加上 0.0001 级尾数。
	rate := operation_setting.GetPaymentSetting().UsdtExchangeRate
	if rate <= 0 {
		rate = operation_setting.USDExchangeRate
	}
	usdValue := decimal.NewFromFloat(payMoney)
	if rate > 0 {
		usdValue = usdValue.Div(decimal.NewFromFloat(rate))
	}
	baseUnits := usdValue.
		Mul(decimal.NewFromInt(100)).
		Ceil().
		Mul(decimal.NewFromInt(model.UsdtUnitsPerCoin / 100)).
		IntPart()
	if baseUnits <= 0 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	tradeNo := xingyeTradeNo("UT")
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   "usdt",
		PaymentProvider: model.PaymentProviderUsdt,
		CreateTime:      now,
		Status:          common.TopUpStatusPending,
	}
	order := &model.UsdtOrder{
		TradeNo:    tradeNo,
		UserId:     id,
		Chain:      receiver.Chain,
		Address:    receiver.Address,
		Amount:     amount,
		CreateTime: now,
		ExpireAt:   now + usdtOrderTimeout,
	}
	if err := model.CreateUsdtOrder(topUp, order, baseUnits); err != nil {
		if errors.Is(err, model.ErrUsdtAmountExhausted) || errors.Is(err, model.ErrUsdtTooManyPending) {
			paymentError(c, err)
			return
		}
		logger.LogError(c.Request.Context(), common.LogText("USDT failed to create top-up order user_id=%d trade_no=%s error=%q", id, tradeNo, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("USDT top-up order created user_id=%d trade_no=%s chain=%s units=%d money=%.2f", id, tradeNo, receiver.Chain, order.PayUnits, payMoney))
	common.ApiSuccess(c, usdtOrderResponse(order))
}

// GetUsdtOrder 供前端轮询订单状态，只能查询自己的订单。
func GetUsdtOrder(c *gin.Context) {
	order := model.GetUsdtOrderByTradeNo(c.Param("trade_no"))
	if order == nil || order.UserId != c.GetInt("id") {
		common.ApiErrorT(c, "Order does not exist")
		return
	}
	common.ApiSuccess(c, usdtOrderResponse(order))
}

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

var (
	bscAddressPattern   = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	aptosAddressPattern = regexp.MustCompile(`^0x[0-9a-fA-F]{1,64}$`)
)

type usdtChainInfo struct {
	Chain   string `json:"chain"`
	Name    string `json:"name"`
	Network string `json:"network"`
}

// usdtChainAddress 返回后台为该链配置的收款地址；格式不对视为未配置。
func usdtChainAddress(chain string) string {
	setting := operation_setting.GetPaymentSetting()
	switch chain {
	case model.UsdtChainBsc:
		address := strings.TrimSpace(setting.UsdtBscAddress)
		if bscAddressPattern.MatchString(address) {
			return strings.ToLower(address)
		}
	case model.UsdtChainAptos:
		address := strings.TrimSpace(setting.UsdtAptosAddress)
		if aptosAddressPattern.MatchString(address) {
			return service.NormalizeAptosAddress(address)
		}
	}
	return ""
}

func usdtEnabledChains() []usdtChainInfo {
	if !isPaymentComplianceConfirmed() || !operation_setting.GetPaymentSetting().UsdtEnabled ||
		operation_setting.GetPaymentSetting().UsdtRate <= 0 {
		return nil
	}
	chains := []usdtChainInfo{}
	if usdtChainAddress(model.UsdtChainBsc) != "" {
		chains = append(chains, usdtChainInfo{Chain: model.UsdtChainBsc, Name: "BSC", Network: "BNB Smart Chain (BEP20)"})
	}
	if usdtChainAddress(model.UsdtChainAptos) != "" {
		chains = append(chains, usdtChainInfo{Chain: model.UsdtChainAptos, Name: "Aptos", Network: "Aptos"})
	}
	return chains
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
	Amount int64  `json:"amount"`
	Chain  string `json:"chain"`
}

func RequestUsdtPay(c *gin.Context) {
	var req UsdtPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	enabled := false
	for _, chain := range usdtEnabledChains() {
		if chain.Chain == req.Chain {
			enabled = true
		}
	}
	if !enabled {
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
	if order := model.FindReusableUsdtOrder(id, req.Chain, amount, now); order != nil {
		common.ApiSuccess(c, usdtOrderResponse(order))
		return
	}

	setting := operation_setting.GetPaymentSetting()
	// 应付 USDT 向上取整到 0.01，再由 CreateUsdtOrder 加上 0.0001 级尾数。
	baseUnits := decimal.NewFromFloat(payMoney).
		Div(decimal.NewFromFloat(setting.UsdtRate)).
		Mul(decimal.NewFromInt(100)).
		Ceil().
		Mul(decimal.NewFromInt(model.UsdtUnitsPerCoin / 100)).
		IntPart()
	if baseUnits <= 0 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	timeout := setting.UsdtOrderTimeoutMinutes
	if timeout <= 0 {
		timeout = 30
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
		Chain:      req.Chain,
		Address:    usdtChainAddress(req.Chain),
		Amount:     amount,
		CreateTime: now,
		ExpireAt:   now + int64(timeout)*60,
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
	logger.LogInfo(c.Request.Context(), common.LogText("USDT top-up order created user_id=%d trade_no=%s chain=%s units=%d money=%.2f", id, tradeNo, req.Chain, order.PayUnits, payMoney))
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

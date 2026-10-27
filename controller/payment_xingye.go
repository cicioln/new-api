package controller

import (
	"crypto/md5"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
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

// 星烨支付原生协议：下单 GET/POST {gateway}/Pay_Index.html，异步通知回复 "OK"。
// 签名：非空参数按 ASCII 升序拼成 k=v&k=v，末尾追加 &key=密钥，MD5 后转大写。
var (
	xingyePurchaseSignKeys = []string{"pay_amount", "pay_applydate", "pay_bankcode", "pay_callbackurl", "pay_memberid", "pay_notifyurl", "pay_orderid"}
	xingyeNotifySignKeys   = []string{"amount", "datetime", "memberid", "orderid", "returncode", "transaction_id"}
	xingyeApplyDateZone    = time.FixedZone("CST", 8*3600)
)

const xingyeTradeSuccess = "00"

// xingyeBankcode 返回支付方式在星烨后台对应的通道编码；未启用星烨或未配置该方式时返回空串，
// 此时订单仍走易支付。
func xingyeBankcode(paymentMethod string) string {
	if !isXingyeTopUpEnabled() {
		return ""
	}
	setting := operation_setting.GetPaymentSetting()
	switch paymentMethod {
	case "alipay":
		return strings.TrimSpace(setting.XingyeAlipayBankcode)
	case "wxpay":
		return strings.TrimSpace(setting.XingyeWxpayBankcode)
	}
	return ""
}

func xingyeSign(params map[string]string, keys []string, secret string) string {
	sorted := slices.Clone(keys)
	slices.Sort(sorted)
	var b strings.Builder
	for _, k := range sorted {
		v := params[k]
		if v == "" {
			continue
		}
		b.WriteString(k)
		b.WriteString("=")
		b.WriteString(v)
		b.WriteString("&")
	}
	b.WriteString("key=")
	b.WriteString(secret)
	sum := md5.Sum([]byte(b.String()))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

// xingyePurchase 生成带签名参数的星烨收银台链接。网关只提供 HTTP，HTTPS 站点向其提交表单会被
// 浏览器拦截提示"信息不安全"，因此改为直接打开 GET 链接。
func xingyePurchase(tradeNo string, money float64, bankcode string, notifyPath string, returnPath string, productName string) string {
	setting := operation_setting.GetPaymentSetting()
	gateway := strings.TrimRight(strings.TrimSpace(setting.XingyeGateway), "/")
	gateway = strings.TrimSuffix(gateway, "/Pay_Index.html")
	callBackAddress := service.GetCallbackAddress()
	params := map[string]string{
		"pay_memberid":    strings.TrimSpace(setting.XingyeMemberId),
		"pay_orderid":     tradeNo,
		"pay_applydate":   time.Now().In(xingyeApplyDateZone).Format("2006-01-02 15:04:05"),
		"pay_bankcode":    bankcode,
		"pay_notifyurl":   callBackAddress + notifyPath,
		"pay_callbackurl": callBackAddress + returnPath,
		"pay_amount":      strconv.FormatFloat(money, 'f', 2, 64),
		"pay_productname": productName,
	}
	params["pay_md5sign"] = xingyeSign(params, xingyePurchaseSignKeys, strings.TrimSpace(setting.XingyeSecret))
	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}
	return gateway + "/Pay_Index.html?" + query.Encode()
}

// xingyeVerifiedCallback 解析星烨的异步通知或页面回跳，签名正确时返回参数。
func xingyeVerifiedCallback(c *gin.Context) (map[string]string, bool) {
	secret := strings.TrimSpace(operation_setting.GetPaymentSetting().XingyeSecret)
	if secret == "" {
		return nil, false
	}
	if err := c.Request.ParseForm(); err != nil {
		return nil, false
	}
	params := make(map[string]string, len(c.Request.Form))
	for k := range c.Request.Form {
		params[k] = c.Request.Form.Get(k)
	}
	sign := strings.ToUpper(params["sign"])
	if sign == "" || params["orderid"] == "" {
		return params, false
	}
	expected := xingyeSign(params, xingyeNotifySignKeys, secret)
	if subtle.ConstantTimeCompare([]byte(sign), []byte(expected)) != 1 {
		return params, false
	}
	if params["memberid"] != strings.TrimSpace(operation_setting.GetPaymentSetting().XingyeMemberId) {
		return params, false
	}
	return params, true
}

// xingyeAmountMatches 校验通知金额与订单金额一致，防止篡改过的低额订单被入账。
func xingyeAmountMatches(notified string, money float64) bool {
	amount, err := decimal.NewFromString(notified)
	if err != nil {
		return false
	}
	return amount.Round(2).Equal(decimal.NewFromFloat(money).Round(2))
}

func xingyeTradeNo(prefix string) string {
	return fmt.Sprintf("%s%d%s", prefix, time.Now().Unix(), common.GetRandomString(6))
}

func startXingyeTopUp(c *gin.Context, userId int, req EpayRequest, payMoney float64, bankcode string) {
	// 星烨订单号最长 20 位：前缀 2 位 + 时间戳 10 位 + 随机 6 位。
	tradeNo := xingyeTradeNo("XY")
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   req.PaymentMethod,
		PaymentProvider: model.PaymentProviderXingye,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Xingye failed to create top-up order user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}
	payLink := xingyePurchase(tradeNo, payMoney, bankcode, "/api/user/xingye/notify", "/api/user/xingye/return", fmt.Sprintf("TUC%d", req.Amount))
	logger.LogInfo(c.Request.Context(), common.LogText("Xingye top-up order created user_id=%d trade_no=%s payment_method=%s amount=%d money=%.2f", userId, tradeNo, req.PaymentMethod, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_link": payLink}})
}

func startXingyeSubscription(c *gin.Context, userId int, plan *model.SubscriptionPlan, paymentMethod string, bankcode string) {
	tradeNo := xingyeTradeNo("XS")
	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   paymentMethod,
		PaymentProvider: model.PaymentProviderXingye,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		common.ApiErrorT(c, "Failed to create order")
		return
	}
	payLink := xingyePurchase(tradeNo, plan.PriceAmount, bankcode, "/api/subscription/xingye/notify", "/api/subscription/xingye/return", fmt.Sprintf("SUB%d", plan.Id))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"pay_link": payLink}})
}

// completeXingyeTopUp 在签名校验通过后入账，返回是否已成功（含幂等重复回调）。
func completeXingyeTopUp(c *gin.Context, params map[string]string) bool {
	tradeNo := params["orderid"]
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || !xingyeAmountMatches(params["amount"], topUp.Money) {
		logger.LogWarn(c.Request.Context(), common.LogText("Xingye callback order missing or amount mismatch trade_no=%s amount=%s client_ip=%s", tradeNo, params["amount"], c.ClientIP()))
		return false
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if _, err := model.RechargeOnlineTopUp(tradeNo, model.PaymentProviderXingye, "", c.ClientIP()); err != nil {
		if !errors.Is(err, model.ErrTopUpNotFound) && !errors.Is(err, model.ErrPaymentMethodMismatch) && !errors.Is(err, model.ErrTopUpStatusInvalid) {
			logger.LogError(c.Request.Context(), common.LogText("Xingye top-up processing failed trade_no=%s error=%q", tradeNo, err.Error()))
		}
		return false
	}
	return true
}

func completeXingyeSubscription(c *gin.Context, params map[string]string) bool {
	tradeNo := params["orderid"]
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil || !xingyeAmountMatches(params["amount"], order.Money) {
		logger.LogWarn(c.Request.Context(), common.LogText("Xingye callback order missing or amount mismatch trade_no=%s amount=%s client_ip=%s", tradeNo, params["amount"], c.ClientIP()))
		return false
	}
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params), model.PaymentProviderXingye, ""); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Xingye subscription processing failed trade_no=%s error=%q", tradeNo, err.Error()))
		return false
	}
	return true
}

func XingyeNotify(c *gin.Context) {
	params, ok := xingyeVerifiedCallback(c)
	if !ok {
		logger.LogWarn(c.Request.Context(), common.LogText("Xingye webhook signature verification failed client_ip=%s params=%q", c.ClientIP(), common.GetJsonString(params)))
		c.String(http.StatusOK, "fail")
		return
	}
	if params["returncode"] != xingyeTradeSuccess {
		c.String(http.StatusOK, "OK")
		return
	}
	if !completeXingyeTopUp(c, params) {
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "OK")
}

// XingyeReturn 是 pay_callbackurl：星烨支付完成后把浏览器 POST 到这里，验签后入账并跳回钱包页，
// 避免浏览器停留在接口响应上。
func XingyeReturn(c *gin.Context) {
	params, ok := xingyeVerifiedCallback(c)
	if !ok || params["returncode"] != xingyeTradeSuccess {
		c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=pending"))
		return
	}
	if !completeXingyeTopUp(c, params) {
		c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=fail"))
		return
	}
	c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=success"))
}

func SubscriptionXingyeNotify(c *gin.Context) {
	params, ok := xingyeVerifiedCallback(c)
	if !ok {
		logger.LogWarn(c.Request.Context(), common.LogText("Xingye webhook signature verification failed client_ip=%s params=%q", c.ClientIP(), common.GetJsonString(params)))
		c.String(http.StatusOK, "fail")
		return
	}
	if params["returncode"] != xingyeTradeSuccess {
		c.String(http.StatusOK, "OK")
		return
	}
	if !completeXingyeSubscription(c, params) {
		c.String(http.StatusOK, "fail")
		return
	}
	c.String(http.StatusOK, "OK")
}

func SubscriptionXingyeReturn(c *gin.Context) {
	params, ok := xingyeVerifiedCallback(c)
	if !ok || params["returncode"] != xingyeTradeSuccess {
		c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=pending"))
		return
	}
	if !completeXingyeSubscription(c, params) {
		c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=fail"))
		return
	}
	c.Redirect(http.StatusFound, paymentReturnPath("/wallet?pay=success"))
}

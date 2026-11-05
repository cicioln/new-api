/**
此文件为旧版支付设置文件，如需增加新的参数、变量等，请在 payment_setting.go 中添加
This file is the old version of the payment settings file. If you need to add new parameters, variables, etc., please add them in payment_setting.go
*/

package operation_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
)

var PayAddress = ""
var CustomCallbackAddress = ""
var EpayId = ""
var EpayKey = ""
var Price = 7.3
var MinTopUp = 1
var USDExchangeRate = 7.3

var PayMethods = []map[string]string{
	{
		"name": "支付宝",
		"icon": "SiAlipay",
		"type": "alipay",
	},
	{
		"name": "微信",
		"icon": "SiWechat",
		"type": "wxpay",
	},
	{
		"name":      "自定义1",
		"icon":      "LuCreditCard",
		"type":      "custom1",
		"min_topup": "50",
	},
}

func UpdatePayMethodsByJsonString(jsonString string) error {
	PayMethods = make([]map[string]string, 0)
	return common.Unmarshal([]byte(jsonString), &PayMethods)
}

func PayMethods2JsonString() string {
	jsonBytes, err := common.Marshal(PayMethods)
	if err != nil {
		return "[]"
	}
	return string(jsonBytes)
}

// PayMethods 条目里的充值赠送 / 手续费百分比（字符串，0-100，和 min_topup 一样存成字符串）。
const (
	PayMethodBonusRateKey = "bonus_rate"
	PayMethodFeeRateKey   = "fee_rate"
)

// 这些类型有各自的下单流程，不经过 RequestEpay，赠送和手续费对它们不生效。
var payMethodTypesWithoutRates = map[string]bool{
	"stripe":        true,
	"waffo":         true,
	"waffo_pancake": true,
	"usdt":          true,
}

// PayMethodSupportsRates 报告该支付方式类型是否支持赠送和手续费。
func PayMethodSupportsRates(methodType string) bool {
	return !payMethodTypesWithoutRates[methodType]
}

func parsePayMethodRate(value string) (decimal.Decimal, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return decimal.Zero, nil
	}
	rate, err := decimal.NewFromString(value)
	if err != nil {
		return decimal.Zero, fmt.Errorf("invalid rate %q", value)
	}
	if rate.IsNegative() || rate.GreaterThan(decimal.NewFromInt(100)) {
		return decimal.Zero, fmt.Errorf("rate %q must be between 0 and 100", value)
	}
	return rate, nil
}

// GetPayMethodRates 返回支付方式的赠送和手续费百分比（0-100），未配置或无效时为 0。
func GetPayMethodRates(method string) (bonusRate decimal.Decimal, feeRate decimal.Decimal) {
	if !PayMethodSupportsRates(method) {
		return decimal.Zero, decimal.Zero
	}
	for _, payMethod := range PayMethods {
		if payMethod["type"] != method {
			continue
		}
		bonusRate, _ = parsePayMethodRate(payMethod[PayMethodBonusRateKey])
		feeRate, _ = parsePayMethodRate(payMethod[PayMethodFeeRateKey])
		return bonusRate, feeRate
	}
	return decimal.Zero, decimal.Zero
}

// ValidatePayMethodsJSON 在保存 PayMethods 前校验赠送和手续费：取值 0-100，且不能同时设置。
func ValidatePayMethodsJSON(jsonString string) error {
	var methods []map[string]string
	if err := common.Unmarshal([]byte(jsonString), &methods); err != nil {
		return fmt.Errorf("PayMethods is not valid JSON: %w", err)
	}
	for _, method := range methods {
		bonusRate, err := parsePayMethodRate(method[PayMethodBonusRateKey])
		if err != nil {
			return fmt.Errorf("payment method %q bonus_rate: %w", method["name"], err)
		}
		feeRate, err := parsePayMethodRate(method[PayMethodFeeRateKey])
		if err != nil {
			return fmt.Errorf("payment method %q fee_rate: %w", method["name"], err)
		}
		if bonusRate.IsPositive() && feeRate.IsPositive() {
			return fmt.Errorf("payment method %q cannot set both bonus_rate and fee_rate", method["name"])
		}
	}
	return nil
}

func ContainsPayMethod(method string) bool {
	for _, payMethod := range PayMethods {
		if payMethod["type"] == method {
			return true
		}
	}
	return false
}

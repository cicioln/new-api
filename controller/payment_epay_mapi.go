package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// 易支付服务端下单（mapi.php）：部分网关的 submit.php 只返回 JSON 而不会跳转收银台，
// 因此先由服务端调用 mapi.php 拿到支付链接，再让浏览器直接打开该链接。
// 网关不支持 mapi.php（返回非 JSON）时回退到原来的 submit.php 表单提交。

var (
	errEpayMapiUnsupported = errors.New("epay gateway does not support mapi.php")
	epayPayLinkPattern     = regexp.MustCompile(`(?i)^(https?|alipays?|weixin):`)
)

// epayMapiError 表示网关明确拒绝了下单，Msg 为网关返回的原因。
type epayMapiError struct {
	Msg string
}

func (e *epayMapiError) Error() string {
	return "epay mapi rejected: " + e.Msg
}

// epayMapiPurchase 用 submit.php 的同一组参数加上付款人 IP 重新签名后请求 mapi.php，返回支付链接。
func epayMapiPurchase(ctx context.Context, args *epay.PurchaseArgs, clientIP string) (string, error) {
	if clientIP == "" {
		clientIP = "127.0.0.1"
	}
	params := map[string]string{
		"pid":          operation_setting.EpayId,
		"type":         args.Type,
		"out_trade_no": args.ServiceTradeNo,
		"notify_url":   args.NotifyUrl.String(),
		"return_url":   args.ReturnUrl.String(),
		"name":         args.Name,
		"money":        args.Money,
		"device":       string(args.Device),
		"clientip":     clientIP,
	}
	signed, err := epay.GenerateParamsWithError(params, operation_setting.EpayKey)
	if err != nil {
		return "", err
	}
	form := url.Values{}
	for k, v := range signed {
		form.Set(k, v)
	}

	endpoint := strings.TrimRight(strings.TrimSpace(operation_setting.PayAddress), "/")
	endpoint = strings.TrimSuffix(endpoint, "/submit.php") + "/mapi.php"
	reqCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}

	var r map[string]any
	if json.Unmarshal(body, &r) != nil {
		return "", errEpayMapiUnsupported
	}
	if link := epayMapiLink(r); link != "" {
		return link, nil
	}
	msg, _ := r["msg"].(string)
	if msg == "" {
		msg = "网关未返回支付链接"
	}
	if len([]rune(msg)) > 60 {
		msg = string([]rune(msg)[:60])
	}
	return "", &epayMapiError{Msg: msg}
}

// epayMapiLink 兼容彩虹易支付（code=1, payurl/qrcode）与星业等（status=1, pay_url/h5_url）。
func epayMapiLink(r map[string]any) string {
	status := r["code"]
	if status == nil {
		status = r["status"]
	}
	if fmt.Sprint(status) != "1" {
		return ""
	}
	for _, k := range []string{"payurl", "pay_url", "h5_url", "qrcode", "urlscheme"} {
		if s, ok := r[k].(string); ok && s != "" && epayPayLinkPattern.MatchString(s) {
			return s
		}
	}
	return ""
}

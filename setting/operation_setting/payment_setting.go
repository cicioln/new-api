package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type PaymentSetting struct {
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"` // 充值金额对应的折扣，例如 100 元 0.9 表示 100 元充值享受 9 折优惠

	ComplianceConfirmed    bool   `json:"compliance_confirmed"`
	ComplianceTermsVersion string `json:"compliance_terms_version"`
	ComplianceConfirmedAt  int64  `json:"compliance_confirmed_at"`
	ComplianceConfirmedBy  int    `json:"compliance_confirmed_by"`
	ComplianceConfirmedIP  string `json:"compliance_confirmed_ip"`

	// 星烨支付原生网关（Pay_Index.html 协议）。密钥字段的 json 名以 secret 结尾，GetOptions 不会下发。
	XingyeEnabled        bool   `json:"xingye_enabled"`
	XingyeGateway        string `json:"xingye_gateway"`
	XingyeMemberId       string `json:"xingye_member_id"`
	XingyeSecret         string `json:"xingye_secret"`
	XingyeAlipayBankcode string `json:"xingye_alipay_bankcode"`
	XingyeWxpayBankcode  string `json:"xingye_wxpay_bankcode"`

	// 内置 USDT 收款：买家按本单唯一金额转账到收款地址，服务端扫描链上转账确认到账。
	// 名称由管理员填写，仅用于展示；扫描哪条链由地址格式决定（0x+40 位为 BSC，0x+64 位为 Aptos，T 开头 34 位为 TRON）。
	// UsdtIcon 是钱包里 USDT 支付方式的图标：react-icons 组件名或图片 URL，留空用 Tether 图标。
	UsdtEnabled   bool          `json:"usdt_enabled"`
	UsdtAddresses []UsdtAddress `json:"usdt_addresses"`
	UsdtIcon      string        `json:"usdt_icon"`
}

type UsdtAddress struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("payment_setting", &paymentSetting)
}

func GetPaymentSetting() *PaymentSetting {
	return &paymentSetting
}

func IsPaymentComplianceConfirmed() bool {
	return paymentSetting.ComplianceConfirmed &&
		paymentSetting.ComplianceTermsVersion == CurrentComplianceTermsVersion
}

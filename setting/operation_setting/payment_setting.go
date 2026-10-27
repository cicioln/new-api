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
	// UsdtRate 是 1 USDT 折合多少充值应付金额（与 Price 同一币种）。
	UsdtEnabled             bool    `json:"usdt_enabled"`
	UsdtBscAddress          string  `json:"usdt_bsc_address"`
	UsdtAptosAddress        string  `json:"usdt_aptos_address"`
	UsdtRate                float64 `json:"usdt_rate"`
	UsdtOrderTimeoutMinutes int     `json:"usdt_order_timeout_minutes"`
	UsdtBscRpc              string  `json:"usdt_bsc_rpc"`
	UsdtBscConfirmations    int     `json:"usdt_bsc_confirmations"`
	UsdtAptosIndexer        string  `json:"usdt_aptos_indexer"`
	UsdtAptosAsset          string  `json:"usdt_aptos_asset"`
	UsdtAptosApiKey         string  `json:"usdt_aptos_api_key"`
}

const CurrentComplianceTermsVersion = "v1"

// 默认配置
var paymentSetting = PaymentSetting{
	AmountOptions:  []int{10, 20, 50, 100, 200, 500},
	AmountDiscount: map[int]float64{},

	UsdtRate:                1,
	UsdtOrderTimeoutMinutes: 30,
	UsdtBscRpc:              "https://bsc-rpc.publicnode.com",
	UsdtBscConfirmations:    5,
	UsdtAptosIndexer:        "https://api.mainnet.aptoslabs.com/v1/graphql",
	UsdtAptosAsset:          "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
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

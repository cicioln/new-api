package model

import (
	"errors"
	"math/rand/v2"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 内置 USDT 收款：每条链只有一个收款地址，用转账金额区分订单。金额以 0.0001 USDT 为单位
// （PayUnits）记录；同一地址上一个金额同一时间只属于一笔订单，由 usdt_amount_slots 的主键保证。

const (
	UsdtChainBsc   = "bsc"
	UsdtChainAptos = "aptos"
	UsdtChainTron  = "tron"

	UsdtOrderStatusPending = "pending"
	UsdtOrderStatusPaid    = "paid"
	UsdtOrderStatusExpired = "expired"

	// UsdtUnitsPerCoin 是 1 USDT 对应的 PayUnits。
	UsdtUnitsPerCoin = 10_000

	// usdtAmountSlots 是同一基础金额可用的尾数个数（0.0000–0.0999 USDT）。
	usdtAmountSlots = 1000

	// usdtPreferredSlots 是优先分配的尾数个数（0.0000–0.0099 USDT），让实际金额尽量贴近应付金额；
	// 这些都被占用时才从 0.0100 起依次往上找。
	usdtPreferredSlots = 100

	// UsdtConfirmGraceSeconds：订单到期后继续等待链上确认的时间，临近到期才转账的订单不会被误关。
	UsdtConfirmGraceSeconds = 10 * 60

	// usdtAmountCooldownSeconds：订单结束后它的金额在这段时间内不分给新订单，
	// 防止买家迟到的转账被记到别人的订单上。
	usdtAmountCooldownSeconds = 24 * 3600

	// UsdtMaxPendingPerUser 防止单个用户刷单占满某个价位的全部尾数。
	UsdtMaxPendingPerUser = 3
)

var (
	ErrUsdtAmountExhausted error = common.NewMessage("Too many pending USDT orders at this amount, please try again later")
	ErrUsdtTooManyPending  error = common.NewMessage("You have too many unpaid USDT orders, please pay or wait for them to expire")
)

type UsdtOrder struct {
	Id         int     `json:"id"`
	TradeNo    string  `json:"trade_no" gorm:"type:varchar(64);uniqueIndex"`
	UserId     int     `json:"user_id" gorm:"index"`
	Chain      string  `json:"chain" gorm:"column:pay_chain;type:varchar(16);uniqueIndex:idx_usdt_orders_chain_tx"`
	Address    string  `json:"address" gorm:"type:varchar(128)"`
	PayUnits   int64   `json:"pay_units"`
	Amount     int64   `json:"amount"`
	Status     string  `json:"status" gorm:"type:varchar(16);index"`
	TxId       *string `json:"tx_id" gorm:"type:varchar(160);uniqueIndex:idx_usdt_orders_chain_tx"`
	CreateTime int64   `json:"create_time"`
	ExpireAt   int64   `json:"expire_at" gorm:"index"`
	PaidAt     int64   `json:"paid_at"`
}

// UsdtAmountSlot 记录某个收款地址上某个金额当前被哪笔订单占用、占用到什么时候。
type UsdtAmountSlot struct {
	Chain       string `gorm:"column:pay_chain;type:varchar(16);primaryKey"`
	Address     string `gorm:"type:varchar(128);primaryKey"`
	PayUnits    int64  `gorm:"primaryKey;autoIncrement:false"`
	TradeNo     string `gorm:"type:varchar(64)"`
	LockedUntil int64  `gorm:"index"`
}

// UsdtScanCursor 保存每条链扫描到的位置（BSC 块号、Aptos 交易版本），重启后从断点继续。
type UsdtScanCursor struct {
	Chain    string `gorm:"column:pay_chain;type:varchar(16);primaryKey"`
	Position int64  `gorm:"column:scan_position"`
}

// FindReusableUsdtOrder 返回同一用户、同一收款地址、同一充值数量且仍可支付的订单，重复点击下单时直接复用。
func FindReusableUsdtOrder(userId int, chain string, address string, amount int64, now int64) *UsdtOrder {
	var order UsdtOrder
	err := DB.Where("user_id = ? AND pay_chain = ? AND address = ? AND amount = ? AND status = ? AND expire_at > ?",
		userId, chain, address, amount, UsdtOrderStatusPending, now+60).
		Order("id desc").First(&order).Error
	if err != nil {
		return nil
	}
	return &order
}

// CreateUsdtOrder 为订单分配唯一的转账金额并写入充值记录与 USDT 订单。baseUnits 是按汇率换算并
// 取整到 0.01 USDT 的金额，实际金额是 baseUnits 加上 0–999 的尾数，优先使用 0–99。
//
// 并发安全不依赖先查后插：每个候选金额先尝试接管已过期的占用行（UPDATE ... WHERE locked_until < now），
// 不存在时再 INSERT ... ON CONFLICT DO NOTHING，影响行数为 1 才算抢到。两个请求抢同一金额时数据库
// 只让一方成功，另一方换下一个尾数；三种数据库与多节点部署下语义一致。尾数从随机位置开始尝试，
// 同时下单的用户一开始就落在不同金额上。
func CreateUsdtOrder(topUp *TopUp, order *UsdtOrder, baseUnits int64) error {
	var err error
	// MySQL 在可重复读下两个事务插入同一间隙可能死锁，换一个起点重试。
	for range 3 {
		err = createUsdtOrderOnce(topUp, order, baseUnits)
		if err == nil || errors.Is(err, ErrUsdtAmountExhausted) || errors.Is(err, ErrUsdtTooManyPending) {
			return err
		}
	}
	return err
}

func createUsdtOrderOnce(topUp *TopUp, order *UsdtOrder, baseUnits int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var pending int64
		if err := tx.Model(&UsdtOrder{}).
			Where("user_id = ? AND status = ? AND expire_at > ?", order.UserId, UsdtOrderStatusPending, order.CreateTime).
			Count(&pending).Error; err != nil {
			return err
		}
		if pending >= UsdtMaxPendingPerUser {
			return ErrUsdtTooManyPending
		}

		lockedUntil := order.ExpireAt + UsdtConfirmGraceSeconds + usdtAmountCooldownSeconds
		start := rand.IntN(usdtPreferredSlots)
		claimed := int64(0)
		for k := range usdtAmountSlots {
			tail := k
			if k < usdtPreferredSlots {
				tail = (start + k) % usdtPreferredSlots
			}
			units := baseUnits + int64(tail)
			res := tx.Model(&UsdtAmountSlot{}).
				Where("pay_chain = ? AND address = ? AND pay_units = ? AND locked_until < ?", order.Chain, order.Address, units, order.CreateTime).
				Updates(map[string]any{"trade_no": order.TradeNo, "locked_until": lockedUntil})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 1 {
				claimed = units
				break
			}
			res = tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&UsdtAmountSlot{
				Chain:       order.Chain,
				Address:     order.Address,
				PayUnits:    units,
				TradeNo:     order.TradeNo,
				LockedUntil: lockedUntil,
			})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 1 {
				claimed = units
				break
			}
		}
		if claimed == 0 {
			return ErrUsdtAmountExhausted
		}

		order.PayUnits = claimed
		order.Status = UsdtOrderStatusPending
		if err := tx.Create(topUp).Error; err != nil {
			return err
		}
		return tx.Create(order).Error
	})
}

func GetUsdtOrderByTradeNo(tradeNo string) *UsdtOrder {
	var order UsdtOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

// GetPendingUsdtOrders 返回仍在等待链上确认的订单（含到期后的确认宽限期）。
func GetPendingUsdtOrders(now int64) ([]UsdtOrder, error) {
	var orders []UsdtOrder
	err := DB.Where("status = ? AND expire_at > ?", UsdtOrderStatusPending, now-UsdtConfirmGraceSeconds).
		Find(&orders).Error
	return orders, err
}

// ClaimUsdtTransfer 把一笔链上转账记到订单上；每笔转账只能用一次（chain + tx_id 唯一），
// 订单也只能被记一次。返回 false 表示订单已不在待支付状态或转账已被使用。
func ClaimUsdtTransfer(tradeNo string, chain string, txId string, now int64) (bool, error) {
	var used int64
	if err := DB.Model(&UsdtOrder{}).Where("pay_chain = ? AND tx_id = ?", chain, txId).Count(&used).Error; err != nil {
		return false, err
	}
	if used > 0 {
		return false, nil
	}
	res := DB.Model(&UsdtOrder{}).
		Where("trade_no = ? AND status = ?", tradeNo, UsdtOrderStatusPending).
		Updates(map[string]any{"tx_id": txId, "status": UsdtOrderStatusPaid, "paid_at": now})
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

// ExpireUsdtOrders 关闭超过确认宽限期仍未到账的订单，并把对应充值记录标记为过期。
func ExpireUsdtOrders(now int64) (int, error) {
	var orders []UsdtOrder
	if err := DB.Where("status = ? AND expire_at <= ?", UsdtOrderStatusPending, now-UsdtConfirmGraceSeconds).
		Find(&orders).Error; err != nil {
		return 0, err
	}
	expired := 0
	for _, order := range orders {
		res := DB.Model(&UsdtOrder{}).
			Where("id = ? AND status = ?", order.Id, UsdtOrderStatusPending).
			Update("status", UsdtOrderStatusExpired)
		if res.Error != nil {
			return expired, res.Error
		}
		if res.RowsAffected == 0 {
			continue
		}
		expired++
		err := UpdatePendingTopUpStatus(order.TradeNo, PaymentProviderUsdt, common.TopUpStatusExpired)
		if err != nil && !errors.Is(err, ErrTopUpStatusInvalid) {
			return expired, err
		}
	}
	return expired, nil
}

func GetUsdtScanCursor(chain string) int64 {
	var cursor UsdtScanCursor
	if err := DB.Where("pay_chain = ?", chain).First(&cursor).Error; err != nil {
		return 0
	}
	return cursor.Position
}

func SetUsdtScanCursor(chain string, position int64) error {
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "pay_chain"}},
		DoUpdates: clause.AssignmentColumns([]string{"scan_position"}),
	}).Create(&UsdtScanCursor{Chain: chain, Position: position}).Error
}

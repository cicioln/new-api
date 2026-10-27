package model

import (
	"fmt"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func truncateUsdtTables(t *testing.T) {
	t.Helper()
	truncateTables(t)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM usdt_orders")
		DB.Exec("DELETE FROM usdt_amount_slots")
		DB.Exec("DELETE FROM usdt_scan_cursors")
	})
}

func newUsdtOrder(userId int, tradeNo string, now int64) (*TopUp, *UsdtOrder) {
	topUp := &TopUp{
		UserId:          userId,
		Amount:          10,
		Money:           10,
		TradeNo:         tradeNo,
		PaymentMethod:   "usdt",
		PaymentProvider: PaymentProviderUsdt,
		CreateTime:      now,
		Status:          common.TopUpStatusPending,
	}
	order := &UsdtOrder{
		TradeNo:    tradeNo,
		UserId:     userId,
		Chain:      UsdtChainBsc,
		Address:    "0xabc",
		Amount:     10,
		CreateTime: now,
		ExpireAt:   now + 1800,
	}
	return topUp, order
}

func TestCreateUsdtOrderGivesConcurrentOrdersDistinctAmounts(t *testing.T) {
	truncateUsdtTables(t)
	const orders = 40
	now := common.GetTimestamp()
	var wg sync.WaitGroup
	errs := make([]error, orders)
	for i := range orders {
		wg.Go(func() {
			// Separate users so the per-user pending limit does not interfere.
			topUp, order := newUsdtOrder(1000+i, fmt.Sprintf("UT-concurrent-%d", i), now)
			errs[i] = CreateUsdtOrder(topUp, order, 100_000)
		})
	}
	wg.Wait()
	for i, err := range errs {
		require.NoError(t, err, "order %d", i)
	}

	var units []int64
	require.NoError(t, DB.Model(&UsdtOrder{}).Pluck("pay_units", &units).Error)
	require.Len(t, units, orders)
	seen := map[int64]bool{}
	for _, u := range units {
		assert.False(t, seen[u], "amount %d assigned twice", u)
		seen[u] = true
		assert.GreaterOrEqual(t, u, int64(100_000))
		assert.Less(t, u, int64(100_000+usdtAmountSlots))
	}
}

func TestCreateUsdtOrderRejectsUserOverPendingLimit(t *testing.T) {
	truncateUsdtTables(t)
	now := common.GetTimestamp()
	for i := range UsdtMaxPendingPerUser {
		topUp, order := newUsdtOrder(7, fmt.Sprintf("UT-limit-%d", i), now)
		require.NoError(t, CreateUsdtOrder(topUp, order, 100_000))
	}
	topUp, order := newUsdtOrder(7, "UT-limit-over", now)
	assert.ErrorIs(t, CreateUsdtOrder(topUp, order, 100_000), ErrUsdtTooManyPending)
}

func TestCreateUsdtOrderReusesAmountOnlyAfterCooldown(t *testing.T) {
	truncateUsdtTables(t)
	now := common.GetTimestamp()
	// Occupy every tail amount except one that has already cooled down.
	for k := range usdtAmountSlots {
		lockedUntil := now + 3600
		if k == 123 {
			lockedUntil = now - 1
		}
		require.NoError(t, DB.Create(&UsdtAmountSlot{
			Chain: UsdtChainBsc, Address: "0xabc", PayUnits: 100_000 + int64(k),
			TradeNo: fmt.Sprintf("old-%d", k), LockedUntil: lockedUntil,
		}).Error)
	}
	topUp, order := newUsdtOrder(8, "UT-reuse", now)
	require.NoError(t, CreateUsdtOrder(topUp, order, 100_000))
	assert.Equal(t, int64(100_123), order.PayUnits)

	topUp, order = newUsdtOrder(9, "UT-exhausted", now)
	assert.ErrorIs(t, CreateUsdtOrder(topUp, order, 100_000), ErrUsdtAmountExhausted)
	assert.Nil(t, GetTopUpByTradeNo("UT-exhausted"), "a failed allocation must not leave a top-up row")
}

func TestClaimUsdtTransferUsesEachTransferOnce(t *testing.T) {
	truncateUsdtTables(t)
	now := common.GetTimestamp()
	for _, tradeNo := range []string{"UT-claim-a", "UT-claim-b"} {
		topUp, order := newUsdtOrder(10, tradeNo, now)
		require.NoError(t, CreateUsdtOrder(topUp, order, 100_000))
	}

	claimed, err := ClaimUsdtTransfer("UT-claim-a", UsdtChainBsc, "0xtx:1", now)
	require.NoError(t, err)
	assert.True(t, claimed)

	claimed, err = ClaimUsdtTransfer("UT-claim-a", UsdtChainBsc, "0xtx:2", now)
	require.NoError(t, err)
	assert.False(t, claimed, "a paid order must not be claimed again")

	claimed, err = ClaimUsdtTransfer("UT-claim-b", UsdtChainBsc, "0xtx:1", now)
	require.NoError(t, err)
	assert.False(t, claimed, "the same transfer must not pay a second order")
}

func TestExpireUsdtOrdersClosesOrderAndTopUpAfterGrace(t *testing.T) {
	truncateUsdtTables(t)
	now := common.GetTimestamp()
	topUp, order := newUsdtOrder(11, "UT-expire", now-4000)
	order.ExpireAt = now - UsdtConfirmGraceSeconds - 1
	require.NoError(t, CreateUsdtOrder(topUp, order, 100_000))

	expired, err := ExpireUsdtOrders(now)
	require.NoError(t, err)
	assert.Equal(t, 1, expired)
	assert.Equal(t, UsdtOrderStatusExpired, GetUsdtOrderByTradeNo("UT-expire").Status)
	assert.Equal(t, common.TopUpStatusExpired, GetTopUpByTradeNo("UT-expire").Status)
}

func TestUsdtScanCursorPersistsLatestPosition(t *testing.T) {
	truncateUsdtTables(t)
	assert.Equal(t, int64(0), GetUsdtScanCursor(UsdtChainAptos))
	require.NoError(t, SetUsdtScanCursor(UsdtChainAptos, 42))
	require.NoError(t, SetUsdtScanCursor(UsdtChainAptos, 99))
	assert.Equal(t, int64(99), GetUsdtScanCursor(UsdtChainAptos))
}

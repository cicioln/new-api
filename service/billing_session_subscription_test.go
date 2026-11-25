package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ensureSubscriptionBillingTables(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(
		&model.SubscriptionPlan{},
		&model.SubscriptionPreConsumeRecord{},
	))
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM subscription_pre_consume_records")
		model.DB.Exec("DELETE FROM subscription_plans")
	})
}

func seedSubscriptionPlanAndActiveSub(t *testing.T, planID, subID, userID int, amountTotal, amountUsed int64, allowWalletOverflow bool) {
	t.Helper()
	now := time.Now().Unix()
	plan := &model.SubscriptionPlan{
		Id:                  planID,
		Title:               "Starter Plan",
		DurationUnit:        model.SubscriptionDurationMonth,
		DurationValue:       1,
		TotalAmount:         amountTotal,
		QuotaResetPeriod:    model.SubscriptionResetNever,
		AllowWalletOverflow: common.GetPointer(allowWalletOverflow),
		Enabled:             true,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	sub := &model.UserSubscription{
		Id:                  subID,
		UserId:              userID,
		PlanId:              planID,
		AmountTotal:         amountTotal,
		AmountUsed:          amountUsed,
		StartTime:           now - 60,
		EndTime:             now + 30*24*3600,
		Status:              "active",
		AllowWalletOverflow: allowWalletOverflow,
	}
	require.NoError(t, model.DB.Create(sub).Error)
}

func newTestBillingContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return ctx
}

func TestBillingSessionSubscriptionSettleOverflowChargesWalletAndExhaustsPlan(t *testing.T) {
	truncate(t)
	ensureSubscriptionBillingTables(t)

	const userID, tokenID, planID, subID = 801, 801, 801, 801
	const initialWallet = 24900000
	const initialTokenRemain = 200000
	const tokenKey = "sk-sub-overflow-1"

	seedUser(t, userID, initialWallet)
	seedToken(t, tokenID, userID, tokenKey, initialTokenRemain)
	seedSubscriptionPlanAndActiveSub(t, planID, subID, userID, 50000, 49965, true)

	// Request 1: simulates CountToken=false (preConsumedQuota=0 => clamped to 1).
	// Subscription has 35 left; actual request costs 57,834.
	ctx1 := newTestBillingContext()
	relayInfo1 := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-overflow-1",
		OriginModelName: "gemini-4-argon",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_first"},
	}

	apiErr := PreConsumeBilling(ctx1, 0, relayInfo1)
	require.Nil(t, apiErr)
	assert.Equal(t, BillingSourceSubscription, relayInfo1.BillingSource)
	assert.Equal(t, 1, relayInfo1.FinalPreConsumedQuota)
	assert.EqualValues(t, 49966, getSubscriptionUsed(t, subID))

	require.NoError(t, SettleBilling(ctx1, relayInfo1, 57834))

	// Subscription is fully exhausted (1 pre-consumed + 34 settled = 35 total from sub).
	// Excess 57,799 is deducted from wallet; full 57,834 is deducted from token.
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-57799, getUserQuota(t, userID))
	assert.Equal(t, initialTokenRemain-57834, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, 57834, getTokenUsedQuota(t, tokenID))

	assert.EqualValues(t, 1, relayInfo1.SubscriptionPreConsumed)
	assert.EqualValues(t, 34, relayInfo1.SubscriptionPostDelta)
	assert.EqualValues(t, 57799, relayInfo1.SubscriptionWalletOverflow)

	other := model.NewLogOther()
	appendBillingInfo(relayInfo1, other)
	snap := other.Snapshot()
	assert.Equal(t, BillingSourceSubscription, snap["billing_source"])
	assert.EqualValues(t, 35, snap["subscription_consumed"])
	assert.EqualValues(t, 50000, snap["subscription_used"])
	assert.EqualValues(t, 0, snap["subscription_remain"])
	assert.EqualValues(t, 57799, snap["wallet_quota_deducted"])

	// Request 2 immediately falls back to wallet because the subscription is exhausted.
	ctx2 := newTestBillingContext()
	relayInfo2 := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-overflow-2",
		OriginModelName: "gemini-4-argon",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_first"},
	}
	apiErr2 := PreConsumeBilling(ctx2, 0, relayInfo2)
	require.Nil(t, apiErr2)
	assert.Equal(t, BillingSourceWallet, relayInfo2.BillingSource)
	require.NoError(t, SettleBilling(ctx2, relayInfo2, 10000))
	assert.Equal(t, initialWallet-57799-10000, getUserQuota(t, userID))
}

func TestBillingSessionSubscriptionSettleOverflowConcurrentRequests(t *testing.T) {
	truncate(t)
	ensureSubscriptionBillingTables(t)

	const userID, tokenID, planID, subID = 802, 802, 802, 802
	const initialWallet = 500000
	const initialTokenRemain = 500000
	const tokenKey = "sk-sub-concurrent"

	seedUser(t, userID, initialWallet)
	seedToken(t, tokenID, userID, tokenKey, initialTokenRemain)
	seedSubscriptionPlanAndActiveSub(t, planID, subID, userID, 50000, 49965, false)

	// Two concurrent requests pre-consume 1 unit each while subscription still has 35 left.
	// Even with allow_wallet_overflow=false and subscription_only, post-execution overflow
	// must be settled to wallet so concurrent calls cannot obtain free quota.
	ctx1 := newTestBillingContext()
	info1 := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-concurrent-1",
		OriginModelName: "claude-opus",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_only"},
	}
	ctx2 := newTestBillingContext()
	info2 := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-concurrent-2",
		OriginModelName: "claude-opus",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_only"},
	}

	require.Nil(t, PreConsumeBilling(ctx1, 0, info1))
	require.Nil(t, PreConsumeBilling(ctx2, 0, info2))
	assert.EqualValues(t, 49967, getSubscriptionUsed(t, subID))

	// Request 1 finishes: absorbs remaining 33 from subscription, charges 49,966 to wallet.
	require.NoError(t, SettleBilling(ctx1, info1, 50000))
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-49966, getUserQuota(t, userID))

	// Request 2 finishes: subscription has 0 remaining, charges entire 19,999 delta to wallet.
	require.NoError(t, SettleBilling(ctx2, info2, 20000))
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-49966-19999, getUserQuota(t, userID))
	assert.Equal(t, initialTokenRemain-70000, getTokenRemainQuota(t, tokenID))

	other2 := model.NewLogOther()
	appendBillingInfo(info2, other2)
	snap2 := other2.Snapshot()
	assert.EqualValues(t, 1, snap2["subscription_consumed"])
	assert.EqualValues(t, 50000, snap2["subscription_used"])
	assert.EqualValues(t, 0, snap2["subscription_remain"])
	assert.EqualValues(t, 19999, snap2["wallet_quota_deducted"])

	// Request 3 is strictly rejected because subscription_only / allow_wallet_overflow=false.
	ctx3 := newTestBillingContext()
	info3 := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-concurrent-3",
		OriginModelName: "claude-opus",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_only"},
	}
	apiErr3 := PreConsumeBilling(ctx3, 0, info3)
	require.NotNil(t, apiErr3)
}

func TestBillingSessionSubscriptionSettleOverflowWalletRetryIsIdempotent(t *testing.T) {
	truncate(t)
	ensureSubscriptionBillingTables(t)

	const userID, tokenID, planID, subID = 803, 803, 803, 803
	const initialWallet = 100000
	const initialTokenRemain = 100000
	const tokenKey = "sk-sub-retry"

	seedUser(t, userID, initialWallet)
	seedToken(t, tokenID, userID, tokenKey, initialTokenRemain)
	seedSubscriptionPlanAndActiveSub(t, planID, subID, userID, 50000, 49965, true)

	ctx := newTestBillingContext()
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-retry-1",
		OriginModelName: "gemini-4-argon",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_first"},
	}
	require.Nil(t, PreConsumeBilling(ctx, 0, info))

	require.NoError(t, model.DB.Exec(`
		CREATE TRIGGER fail_sub_overflow_wallet_update
		BEFORE UPDATE ON users
		WHEN OLD.id = 803
		BEGIN
			SELECT RAISE(ABORT, 'forced wallet overflow failure');
		END;
	`).Error)
	t.Cleanup(func() {
		model.DB.Exec("DROP TRIGGER IF EXISTS fail_sub_overflow_wallet_update")
	})

	// First settle exhausts subscription (34) then fails on wallet overflow (57,799).
	err := SettleBilling(ctx, info, 57834)
	require.Error(t, err)
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet, getUserQuota(t, userID))
	assert.False(t, info.Billing.NeedsRefund(), "partially settled subscription must not be refunded")

	// After DB recovers, retrying Settle charges only the pending 57,799 overflow.
	require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS fail_sub_overflow_wallet_update").Error)
	require.NoError(t, SettleBilling(ctx, info, 57834))
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-57799, getUserQuota(t, userID))
	assert.Equal(t, initialTokenRemain-57834, getTokenRemainQuota(t, tokenID))
	assert.EqualValues(t, 34, info.SubscriptionPostDelta)
	assert.EqualValues(t, 57799, info.SubscriptionWalletOverflow)
}

func TestBillingSessionSubscriptionReserveStillRejectsOverLimit(t *testing.T) {
	truncate(t)
	ensureSubscriptionBillingTables(t)

	const userID, tokenID, planID, subID = 804, 804, 804, 804
	const tokenKey = "sk-sub-reserve"

	seedUser(t, userID, 100000)
	seedToken(t, tokenID, userID, tokenKey, 100000)
	seedSubscriptionPlanAndActiveSub(t, planID, subID, userID, 50000, 49965, true)

	ctx := newTestBillingContext()
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        tokenKey,
		RequestId:       "req-sub-reserve-1",
		OriginModelName: "gpt-image-1",
		UserSetting:     dto.UserSetting{BillingPreference: "subscription_first"},
	}
	require.Nil(t, PreConsumeBilling(ctx, 0, info))
	assert.EqualValues(t, 49966, getSubscriptionUsed(t, subID))

	// Pre-execution Reserve must still reject over-limit subscription deltas.
	err := info.Billing.Reserve(500)
	require.Error(t, err)
	assert.EqualValues(t, 49966, getSubscriptionUsed(t, subID))
	assert.Equal(t, 100000, getUserQuota(t, userID))
}

func TestPostConsumeQuotaLegacySubscriptionOverflowChargesWallet(t *testing.T) {
	truncate(t)
	ensureSubscriptionBillingTables(t)

	const userID, tokenID, planID, subID = 805, 805, 805, 805
	const initialWallet = 100000
	const initialTokenRemain = 100000
	const tokenKey = "sk-sub-legacy"

	seedUser(t, userID, initialWallet)
	seedToken(t, tokenID, userID, tokenKey, initialTokenRemain)
	seedSubscriptionPlanAndActiveSub(t, planID, subID, userID, 50000, 49980, true)

	info := &relaycommon.RelayInfo{
		UserId:                                userID,
		TokenId:                               tokenID,
		TokenKey:                              tokenKey,
		BillingSource:                         BillingSourceSubscription,
		SubscriptionId:                        subID,
		SubscriptionPreConsumed:               1,
		SubscriptionAmountTotal:               50000,
		SubscriptionAmountUsedAfterPreConsume: 49980,
	}

	require.NoError(t, PostConsumeQuota(info, 1000, 1, false))
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-980, getUserQuota(t, userID))
	assert.Equal(t, initialTokenRemain-1000, getTokenRemainQuota(t, tokenID))
	assert.EqualValues(t, 20, info.SubscriptionPostDelta)
	assert.EqualValues(t, 980, info.SubscriptionWalletOverflow)
}

func TestRecalculateTaskQuotaSubscriptionOverflowChargesWallet(t *testing.T) {
	truncate(t)
	ctx := context.Background()

	const userID, tokenID, channelID, subID = 806, 806, 806, 806
	const initialWallet = 100000
	const initialTokenRemain = 100000
	const preConsumed = 2000
	const actualQuota = 5000

	seedUser(t, userID, initialWallet)
	seedToken(t, tokenID, userID, "sk-sub-task-overflow", initialTokenRemain)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, 50000, 49500)
	seedChargedAccounting(t, userID, channelID, tokenID, preConsumed, 1)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceSubscription, subID)
	require.NoError(t, model.DB.Create(task).Error)

	RecalculateTaskQuota(ctx, task, actualQuota, common.NewMessage("subscription task overflow"))

	// Delta is 3000: subscription absorbs remaining 500, wallet absorbs overflow 2500.
	assert.EqualValues(t, 50000, getSubscriptionUsed(t, subID))
	assert.Equal(t, initialWallet-2500, getUserQuota(t, userID))
	assert.Equal(t, initialTokenRemain-3000, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, actualQuota, task.Quota)
}

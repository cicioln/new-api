package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSettleUserSubscriptionDelta(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	activeEnd := now + 30*24*3600

	t.Run("caps used at total and returns overflow", func(t *testing.T) {
		sub := &UserSubscription{
			Id:                  9701,
			UserId:              701,
			PlanId:              1,
			AmountTotal:         50000,
			AmountUsed:          49966,
			StartTime:           now - 60,
			EndTime:             activeEnd,
			Status:              "active",
			AllowWalletOverflow: true,
		}
		require.NoError(t, DB.Create(sub).Error)

		res, err := SettleUserSubscriptionDelta(sub.Id, 57833)
		require.NoError(t, err)
		require.NotNil(t, res)
		assert.EqualValues(t, 34, res.SubscriptionDelta)
		assert.EqualValues(t, 57799, res.Overflow)
		assert.EqualValues(t, 50000, res.AmountTotal)
		assert.EqualValues(t, 50000, res.AmountUsed)

		var reloaded UserSubscription
		require.NoError(t, DB.Where("id = ?", sub.Id).First(&reloaded).Error)
		assert.EqualValues(t, 50000, reloaded.AmountUsed)

		// A subsequent concurrent settlement against the already-exhausted subscription
		// routes the entire delta to Overflow without modifying AmountUsed.
		res2, err := SettleUserSubscriptionDelta(sub.Id, 12000)
		require.NoError(t, err)
		require.NotNil(t, res2)
		assert.EqualValues(t, 0, res2.SubscriptionDelta)
		assert.EqualValues(t, 12000, res2.Overflow)
		assert.EqualValues(t, 50000, res2.AmountUsed)
	})

	t.Run("applies within-limit and unlimited deltas without overflow", func(t *testing.T) {
		finiteSub := &UserSubscription{
			Id:          9702,
			UserId:      702,
			PlanId:      1,
			AmountTotal: 50000,
			AmountUsed:  10000,
			StartTime:   now - 60,
			EndTime:     activeEnd,
			Status:      "active",
		}
		unlimitedSub := &UserSubscription{
			Id:          9703,
			UserId:      703,
			PlanId:      2,
			AmountTotal: 0,
			AmountUsed:  10000,
			StartTime:   now - 60,
			EndTime:     activeEnd,
			Status:      "active",
		}
		require.NoError(t, DB.Create(finiteSub).Error)
		require.NoError(t, DB.Create(unlimitedSub).Error)

		res, err := SettleUserSubscriptionDelta(finiteSub.Id, 15000)
		require.NoError(t, err)
		assert.EqualValues(t, 15000, res.SubscriptionDelta)
		assert.Zero(t, res.Overflow)
		assert.EqualValues(t, 25000, res.AmountUsed)

		resUnlimited, err := SettleUserSubscriptionDelta(unlimitedSub.Id, 90000)
		require.NoError(t, err)
		assert.EqualValues(t, 90000, resUnlimited.SubscriptionDelta)
		assert.Zero(t, resUnlimited.Overflow)
		assert.EqualValues(t, 100000, resUnlimited.AmountUsed)
	})

	t.Run("clamps negative refunds at zero", func(t *testing.T) {
		sub := &UserSubscription{
			Id:          9704,
			UserId:      704,
			PlanId:      1,
			AmountTotal: 50000,
			AmountUsed:  120,
			StartTime:   now - 60,
			EndTime:     activeEnd,
			Status:      "active",
		}
		require.NoError(t, DB.Create(sub).Error)

		res, err := SettleUserSubscriptionDelta(sub.Id, -500)
		require.NoError(t, err)
		assert.EqualValues(t, -120, res.SubscriptionDelta)
		assert.Zero(t, res.Overflow)
		assert.Zero(t, res.AmountUsed)

		var reloaded UserSubscription
		require.NoError(t, DB.Where("id = ?", sub.Id).First(&reloaded).Error)
		assert.Zero(t, reloaded.AmountUsed)
	})

	t.Run("PostConsumeUserSubscriptionDelta stays strict for reservations", func(t *testing.T) {
		sub := &UserSubscription{
			Id:          9705,
			UserId:      705,
			PlanId:      1,
			AmountTotal: 50000,
			AmountUsed:  49966,
			StartTime:   now - 60,
			EndTime:     activeEnd,
			Status:      "active",
		}
		require.NoError(t, DB.Create(sub).Error)

		err := PostConsumeUserSubscriptionDelta(sub.Id, 100)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "subscription used exceeds total")

		var reloaded UserSubscription
		require.NoError(t, DB.Where("id = ?", sub.Id).First(&reloaded).Error)
		assert.EqualValues(t, 49966, reloaded.AmountUsed)
	})
}

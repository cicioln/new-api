package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminSubscriptionListAndSubscriberCounts(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	team := &SubscriptionPlan{Id: 9301, Title: "Team", DurationUnit: SubscriptionDurationMonth, DurationValue: 1}
	starter := &SubscriptionPlan{Id: 9302, Title: "Starter", DurationUnit: SubscriptionDurationMonth, DurationValue: 1}
	require.NoError(t, DB.Create(team).Error)
	require.NoError(t, DB.Create(starter).Error)
	lin := &User{Username: "lin_w", Password: "password", AffCode: "sub-list-lin"}
	cat := &User{Username: "k8s_cat", Password: "password", AffCode: "sub-list-cat"}
	require.NoError(t, DB.Create(lin).Error)
	require.NoError(t, DB.Create(cat).Error)

	subs := []UserSubscription{
		{Id: 9401, UserId: lin.Id, PlanId: team.Id, AmountTotal: 100, AmountUsed: 64, StartTime: now - 10, EndTime: now + 3600, Status: "active"},
		{Id: 9402, UserId: lin.Id, PlanId: team.Id, AmountTotal: 100, StartTime: now - 10, EndTime: now + 3600, Status: "active"},
		{Id: 9403, UserId: cat.Id, PlanId: team.Id, AmountTotal: 100, StartTime: now - 10, EndTime: now - 1, Status: "active"},
		{Id: 9404, UserId: cat.Id, PlanId: starter.Id, AmountTotal: 100, StartTime: now - 10, EndTime: now + 3600, Status: "active"},
		{Id: 9405, UserId: cat.Id, PlanId: starter.Id, AmountTotal: 100, StartTime: now - 10, EndTime: now + 3600, Status: "cancelled"},
	}
	require.NoError(t, DB.Create(&subs).Error)

	counts, err := CountActiveSubscribersByPlan()
	require.NoError(t, err)
	assert.Equal(t, map[int]int64{team.Id: 1, starter.Id: 1}, counts)

	items, total, err := ListAdminUserSubscriptions(0, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(5), total)
	require.Len(t, items, 2)
	assert.Equal(t, 9405, items[0].Id)
	assert.Equal(t, "k8s_cat", items[0].Username)
	assert.Equal(t, "Starter", items[0].PlanTitle)

	items, _, err = ListAdminUserSubscriptions(4, 2)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "lin_w", items[0].Username)
	assert.Equal(t, "Team", items[0].PlanTitle)
	assert.Equal(t, int64(64), items[0].AmountUsed)
}

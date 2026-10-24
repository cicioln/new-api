package model

import "github.com/QuantumNous/new-api/common"

// AdminUserSubscriptionItem is a user subscription row for the admin subscriber list.
type AdminUserSubscriptionItem struct {
	UserSubscription
	Username  string `json:"username"`
	PlanTitle string `json:"plan_title"`
}

// CountActiveSubscribersByPlan returns the number of distinct users holding an
// active, unexpired subscription for each plan.
func CountActiveSubscribersByPlan() (map[int]int64, error) {
	var rows []struct {
		PlanId int
		Total  int64
	}
	err := DB.Model(&UserSubscription{}).
		Select("plan_id, COUNT(DISTINCT user_id) AS total").
		Where("status = ? AND end_time > ?", "active", common.GetTimestamp()).
		Group("plan_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := make(map[int]int64, len(rows))
	for _, row := range rows {
		counts[row.PlanId] = row.Total
	}
	return counts, nil
}

// ListAdminUserSubscriptions pages through all user subscriptions, newest first,
// with the username and plan title resolved for display.
func ListAdminUserSubscriptions(startIdx int, num int) ([]AdminUserSubscriptionItem, int64, error) {
	var total int64
	if err := DB.Model(&UserSubscription{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var subs []UserSubscription
	if err := DB.Order("id desc").Limit(num).Offset(startIdx).Find(&subs).Error; err != nil {
		return nil, 0, err
	}
	items := make([]AdminUserSubscriptionItem, 0, len(subs))
	if len(subs) == 0 {
		return items, total, nil
	}

	userIds := make([]int, 0, len(subs))
	planIds := make([]int, 0, len(subs))
	for _, sub := range subs {
		userIds = append(userIds, sub.UserId)
		planIds = append(planIds, sub.PlanId)
	}
	var users []struct {
		Id       int
		Username string
	}
	if err := DB.Model(&User{}).Unscoped().Select("id", "username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	var plans []struct {
		Id    int
		Title string
	}
	if err := DB.Model(&SubscriptionPlan{}).Select("id", "title").Where("id IN ?", planIds).Find(&plans).Error; err != nil {
		return nil, 0, err
	}
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	planTitles := make(map[int]string, len(plans))
	for _, plan := range plans {
		planTitles[plan.Id] = plan.Title
	}
	for _, sub := range subs {
		items = append(items, AdminUserSubscriptionItem{
			UserSubscription: sub,
			Username:         usernames[sub.UserId],
			PlanTitle:        planTitles[sub.PlanId],
		})
	}
	return items, total, nil
}

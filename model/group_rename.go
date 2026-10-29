package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"gorm.io/gorm"
)

// GroupRenameResult counts the rows rewritten by RenameGroups.
type GroupRenameResult struct {
	Channels      int `json:"channels"`
	Users         int `json:"users"`
	Tokens        int `json:"tokens"`
	PelicanRecord int `json:"pelican_records"`
	Subscriptions int `json:"subscriptions"`
}

// NormalizeGroupRenames drops blank and identity entries.
func NormalizeGroupRenames(renames map[string]string) map[string]string {
	result := make(map[string]string, len(renames))
	for from, to := range renames {
		from, to = strings.TrimSpace(from), strings.TrimSpace(to)
		if from == "" || to == "" || from == to {
			continue
		}
		result[from] = to
	}
	return result
}

func renameGroupList(value string, renames map[string]string) (string, bool) {
	if value == "" {
		return value, false
	}
	parts := strings.Split(value, ",")
	seen := make(map[string]struct{}, len(parts))
	out := make([]string, 0, len(parts))
	changed := false
	for _, part := range parts {
		name := strings.TrimSpace(part)
		if to, ok := renames[name]; ok {
			name = to
			changed = true
		}
		if _, dup := seen[name]; dup {
			changed = true
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	return strings.Join(out, ","), changed
}

// renameGroupColumn rewrites a single-group column. Ids are collected for
// every old name before any write so swaps (a→b, b→a) stay correct.
func renameGroupColumn(tx *gorm.DB, table any, column string, renames map[string]string) ([]int, error) {
	pending := make(map[string][]int, len(renames))
	affected := make([]int, 0)
	for from := range renames {
		var ids []int
		if err := tx.Model(table).Where(column+" = ?", from).Pluck("id", &ids).Error; err != nil {
			return nil, err
		}
		pending[from] = ids
	}
	for from, ids := range pending {
		if len(ids) == 0 {
			continue
		}
		if err := tx.Model(table).Where("id IN ?", ids).UpdateColumn(strings.Trim(column, "`\""), renames[from]).Error; err != nil {
			return nil, err
		}
		affected = append(affected, ids...)
	}
	return affected, nil
}

// RenameGroups propagates group renames from the group pricing settings to
// every table that stores group names. Historical data (logs, usage stats,
// tasks) keeps the name it was recorded with.
func RenameGroups(renames map[string]string) (*GroupRenameResult, error) {
	renames = NormalizeGroupRenames(renames)
	result := &GroupRenameResult{}
	if len(renames) == 0 {
		return result, nil
	}

	var changedChannels []*Channel
	var changedUsers []int
	var changedTokenKeys []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []*Channel
		if err := tx.Select("id", "models", commonGroupCol, "status", "priority", "weight", "tag").Find(&channels).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			next, changed := renameGroupList(channel.Group, renames)
			if !changed {
				continue
			}
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).UpdateColumn("group", next).Error; err != nil {
				return err
			}
			channel.Group = next
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}
			changedChannels = append(changedChannels, channel)
		}

		users, err := renameGroupColumn(tx, &User{}, commonGroupCol, renames)
		if err != nil {
			return err
		}
		changedUsers = users

		var tokens []Token
		if err := tx.Select("id", commonKeyCol, commonGroupCol, "auto_groups").Find(&tokens).Error; err != nil {
			return err
		}
		for _, token := range tokens {
			updates := map[string]any{}
			if to, ok := renames[token.Group]; ok {
				updates["group"] = to
			}
			if groups, err := token.GetAutoGroups(); err == nil && len(groups) > 0 {
				next, changed := renameGroupList(strings.Join(groups, ","), renames)
				if changed {
					if err := token.SetAutoGroups(strings.Split(next, ",")); err != nil {
						return err
					}
					updates["auto_groups"] = token.AutoGroups
				}
			}
			if len(updates) == 0 {
				continue
			}
			if err := invalidateTokenCacheForMutation(token.Key); err != nil {
				common.SysError(common.LogText("failed to invalidate token cache during group rename: %s", err.Error()))
			}
			if err := tx.Model(&Token{}).Where("id = ?", token.Id).UpdateColumns(updates).Error; err != nil {
				return err
			}
			changedTokenKeys = append(changedTokenKeys, token.Key)
		}

		pelican, err := renameGroupColumn(tx, &PelicanRecord{}, commonGroupCol, renames)
		if err != nil {
			return err
		}
		result.PelicanRecord = len(pelican)

		for _, column := range []string{"upgrade_group", "downgrade_group"} {
			plans, err := renameGroupColumn(tx, &SubscriptionPlan{}, column, renames)
			if err != nil {
				return err
			}
			result.Subscriptions += len(plans)
		}
		for _, column := range []string{"upgrade_group", "prev_user_group", "downgrade_group"} {
			subs, err := renameGroupColumn(tx, &UserSubscription{}, column, renames)
			if err != nil {
				return err
			}
			result.Subscriptions += len(subs)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	result.Channels = len(changedChannels)
	result.Users = len(changedUsers)
	result.Tokens = len(changedTokenKeys)

	for _, userId := range changedUsers {
		if err := RefreshUserGroupCache(userId); err != nil {
			common.SysError(common.LogText("failed to refresh user group cache during group rename: %s", err.Error()))
		}
	}
	for _, key := range changedTokenKeys {
		_ = invalidateTokenCacheForMutation(key)
	}
	if result.Subscriptions > 0 {
		_ = getSubscriptionPlanCache().Purge()
		_ = getSubscriptionPlanInfoCache().Purge()
	}
	if len(changedChannels) > 0 {
		InitChannelCache()
	}
	if err := renameRateLimitGroups(renames); err != nil {
		return result, err
	}
	return result, nil
}

func renameRateLimitGroups(renames map[string]string) error {
	setting.ModelRequestRateLimitMutex.RLock()
	current := make(map[string][2]int, len(setting.ModelRequestRateLimitGroup))
	for name, limit := range setting.ModelRequestRateLimitGroup {
		current[name] = limit
	}
	setting.ModelRequestRateLimitMutex.RUnlock()

	next := make(map[string][2]int, len(current))
	changed := false
	for name, limit := range current {
		if to, ok := renames[name]; ok {
			name = to
			changed = true
		}
		next[name] = limit
	}
	if !changed {
		return nil
	}
	data, err := common.Marshal(next)
	if err != nil {
		return err
	}
	return UpdateOption("ModelRequestRateLimitGroup", string(data))
}

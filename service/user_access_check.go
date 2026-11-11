package service

import (
	"slices"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// Access check step results. The web console renders each step by its key and
// result; Detail carries the values the step looked at.
const (
	AccessCheckPass = "pass"
	AccessCheckFail = "fail"
	AccessCheckInfo = "info"
)

type AccessCheckStep struct {
	Key    string         `json:"key"`
	Result string         `json:"result"`
	Detail map[string]any `json:"detail,omitempty"`
}

type AccessCheckChannel struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Status int    `json:"status"`
}

type AccessCheckResult struct {
	Allowed        bool                 `json:"allowed"`
	Model          string               `json:"model"`
	EffectiveGroup string               `json:"effective_group"`
	Steps          []AccessCheckStep    `json:"steps"`
	Channels       []AccessCheckChannel `json:"channels"`
	// GroupsWithModel lists the groups this user may select whose enabled
	// channels serve the model, so an administrator can see where to move it.
	GroupsWithModel []string `json:"groups_with_model"`
}

// AccessCheckInput describes the request to simulate. GroupOverride, when set,
// replaces the token group for a what-if check without changing anything.
type AccessCheckInput struct {
	User          *model.User
	Token         *model.Token
	Model         string
	GroupOverride string
	HasOverride   bool
}

// CheckUserModelAccess walks the decisions the gateway makes before it picks
// a channel: user status, token state, the group the request runs under, the
// token model limit and finally the enabled channels of that group. It reads
// configuration only and never contacts an upstream.
func CheckUserModelAccess(input AccessCheckInput) AccessCheckResult {
	result := AccessCheckResult{Model: input.Model, Steps: []AccessCheckStep{}, Channels: []AccessCheckChannel{}}
	fail := func(step AccessCheckStep) AccessCheckResult {
		step.Result = AccessCheckFail
		result.Steps = append(result.Steps, step)
		result.GroupsWithModel = groupsServingModel(input.User.Group, input.Model)
		return result
	}

	user := input.User
	if user.Status != common.UserStatusEnabled {
		return fail(AccessCheckStep{Key: "user_status", Detail: map[string]any{"status": user.Status}})
	}
	result.Steps = append(result.Steps, AccessCheckStep{Key: "user_status", Result: AccessCheckPass, Detail: map[string]any{"quota": user.Quota}})

	token := input.Token
	if token != nil {
		tokenDetail := map[string]any{"token_id": token.Id, "token_name": token.Name}
		switch {
		case token.Status != common.TokenStatusEnabled:
			tokenDetail["status"] = token.Status
			return fail(AccessCheckStep{Key: "token_status", Detail: tokenDetail})
		case token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp():
			tokenDetail["expired_time"] = token.ExpiredTime
			return fail(AccessCheckStep{Key: "token_expired", Detail: tokenDetail})
		case !token.UnlimitedQuota && token.RemainQuota <= 0:
			return fail(AccessCheckStep{Key: "token_quota", Detail: tokenDetail})
		}
		result.Steps = append(result.Steps, AccessCheckStep{Key: "token_status", Result: AccessCheckPass, Detail: tokenDetail})
	}

	tokenGroup := ""
	if token != nil {
		tokenGroup = token.Group
	}
	if input.HasOverride {
		tokenGroup = input.GroupOverride
	}
	effectiveGroup := user.Group
	groupDetail := map[string]any{"user_group": user.Group, "token_group": tokenGroup, "simulated": input.HasOverride}
	if tokenGroup != "" {
		if !GroupInUserUsableGroups(user.Group, tokenGroup) {
			groupDetail["group"] = tokenGroup
			return fail(AccessCheckStep{Key: "group_forbidden", Detail: groupDetail})
		}
		if tokenGroup != "auto" && !ratio_setting.ContainsGroupRatio(tokenGroup) {
			groupDetail["group"] = tokenGroup
			return fail(AccessCheckStep{Key: "group_deprecated", Detail: groupDetail})
		}
		effectiveGroup = tokenGroup
	}
	result.EffectiveGroup = effectiveGroup
	groupDetail["effective_group"] = effectiveGroup
	result.Steps = append(result.Steps, AccessCheckStep{Key: "effective_group", Result: AccessCheckInfo, Detail: groupDetail})

	if token != nil && token.ModelLimitsEnabled {
		limits := token.GetModelLimitsMap()
		if !modelLimitAllows(limits, input.Model) {
			return fail(AccessCheckStep{Key: "model_limit", Detail: map[string]any{"limits": token.GetModelLimits()}})
		}
		result.Steps = append(result.Steps, AccessCheckStep{Key: "model_limit", Result: AccessCheckPass, Detail: map[string]any{"enabled": true}})
	} else {
		result.Steps = append(result.Steps, AccessCheckStep{Key: "model_limit", Result: AccessCheckPass, Detail: map[string]any{"enabled": false}})
	}

	candidateGroups := []string{effectiveGroup}
	if effectiveGroup == "auto" {
		candidateGroups = autoGroupsForToken(user.Group, token)
	}
	channelIDs := map[int]struct{}{}
	matchedGroups := []string{}
	for _, group := range candidateGroups {
		ids := enabledChannelIDs(group, input.Model)
		if len(ids) > 0 {
			matchedGroups = append(matchedGroups, group)
		}
		for _, id := range ids {
			channelIDs[id] = struct{}{}
		}
	}
	channelDetail := map[string]any{"groups": candidateGroups}
	if len(channelIDs) == 0 {
		if maintenance, ok := model.GetModelMaintenance(input.Model); ok {
			channelDetail["maintenance_note"] = maintenance.Note
			channelDetail["maintenance_until"] = maintenance.Until
			return fail(AccessCheckStep{Key: "model_maintenance", Detail: channelDetail})
		}
		return fail(AccessCheckStep{Key: "channels", Detail: channelDetail})
	}
	ids := make([]int, 0, len(channelIDs))
	for id := range channelIDs {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	if channels, err := model.GetChannelsByIds(ids); err == nil {
		for _, channel := range channels {
			result.Channels = append(result.Channels, AccessCheckChannel{Id: channel.Id, Name: channel.Name, Status: channel.Status})
		}
		sort.Slice(result.Channels, func(i, j int) bool { return result.Channels[i].Id < result.Channels[j].Id })
	}
	channelDetail["matched_groups"] = matchedGroups
	channelDetail["count"] = len(ids)
	result.Steps = append(result.Steps, AccessCheckStep{Key: "channels", Result: AccessCheckPass, Detail: channelDetail})
	result.Allowed = true
	result.GroupsWithModel = groupsServingModel(user.Group, input.Model)
	return result
}

// modelLimitAllows mirrors middleware.TokenModelLimitAllows, which this
// package cannot import.
func modelLimitAllows(limit map[string]bool, modelName string) bool {
	if limit[modelName] {
		return true
	}
	if formatted := ratio_setting.FormatMatchingModelName(modelName); limit[formatted] {
		return true
	}
	return limit[ratio_setting.RoutingMatchModelName(modelName)]
}

func autoGroupsForToken(userGroup string, token *model.Token) []string {
	if token != nil && token.AutoGroups != "" {
		if groups, err := token.GetAutoGroups(); err == nil && len(groups) > 0 {
			return FilterUserTokenAutoGroups(userGroup, groups)
		}
	}
	return GetUserAutoGroup(userGroup)
}

// enabledChannelIDs returns the enabled channels serving modelName in group,
// trying the routing-normalized name as channel selection does.
func enabledChannelIDs(group string, modelName string) []int {
	ids := model.GetEnabledChannelIDsForGroupModel(group, modelName)
	if len(ids) > 0 {
		return ids
	}
	normalized := ratio_setting.RoutingMatchModelName(modelName)
	if normalized == "" || normalized == modelName {
		return nil
	}
	return model.GetEnabledChannelIDsForGroupModel(group, normalized)
}

func groupsServingModel(userGroup string, modelName string) []string {
	groups := []string{}
	for group := range GetUserUsableGroups(userGroup) {
		if group == "auto" {
			continue
		}
		if len(enabledChannelIDs(group, modelName)) > 0 {
			groups = append(groups, group)
		}
	}
	slices.Sort(groups)
	return groups
}

type UserGroupOverview struct {
	Group       string   `json:"group"`
	Description string   `json:"description"`
	Ratio       float64  `json:"ratio"`
	IsUserGroup bool     `json:"is_user_group"`
	Channels    int      `json:"channels"`
	Models      []string `json:"models"`
}

// GetUserGroupOverview lists the groups a user may select with the ratio the
// user pays there and what each group serves.
func GetUserGroupOverview(userGroup string) []UserGroupOverview {
	usable := GetUserUsableGroups(userGroup)
	overview := make([]UserGroupOverview, 0, len(usable))
	for group, description := range usable {
		if group == "auto" {
			continue
		}
		models := model.GetGroupEnabledModels(group)
		slices.Sort(models)
		overview = append(overview, UserGroupOverview{
			Group:       group,
			Description: description,
			Ratio:       GetUserGroupRatio(userGroup, group),
			IsUserGroup: group == userGroup,
			Channels:    model.CountEnabledChannelsInGroup(group),
			Models:      models,
		})
	}
	sort.Slice(overview, func(i, j int) bool {
		if overview[i].IsUserGroup != overview[j].IsUserGroup {
			return overview[i].IsUserGroup
		}
		return strings.Compare(overview[i].Group, overview[j].Group) < 0
	})
	return overview
}

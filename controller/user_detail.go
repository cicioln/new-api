package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// Administrator views of one user's configuration: tokens, usable groups and
// a dry-run of the gateway's channel selection for a model.

// maxAdminUserTokens bounds the token list in the user detail panel.
const maxAdminUserTokens = 200

type adminUserTokenResponse struct {
	*tokenResponse
	// EffectiveGroup is the group requests with this token run under: the
	// token group, or the user group when the token sets none.
	EffectiveGroup    string `json:"effective_group"`
	InheritsUserGroup bool   `json:"inherits_user_group"`
	TokenGroupUsable  bool   `json:"token_group_usable"`
}

// loadManagedUser reads the :id user and rejects targets the operator may not
// manage. It writes the error response itself.
func loadManagedUser(c *gin.Context) *model.User {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return nil
	}
	user, err := model.GetUserById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return nil
	}
	if !canManageTargetRole(c.GetInt("role"), user.Role) {
		common.ApiErrorT(c, "No permission to access users of same or higher level")
		return nil
	}
	return user
}

func GetUserTokensByAdmin(c *gin.Context) {
	user := loadManagedUser(c)
	if user == nil {
		return
	}
	tokens, err := model.GetAllUserTokens(user.Id, 0, maxAdminUserTokens)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	total, _ := model.CountUserTokens(user.Id)
	items := make([]*adminUserTokenResponse, 0, len(tokens))
	for _, token := range tokens {
		effective := user.Group
		usable := true
		if token.Group != "" {
			effective = token.Group
			usable = service.GroupInUserUsableGroups(user.Group, token.Group) &&
				(token.Group == "auto" || ratio_setting.ContainsGroupRatio(token.Group))
		}
		items = append(items, &adminUserTokenResponse{
			tokenResponse:     buildMaskedTokenResponse(token),
			EffectiveGroup:    effective,
			InheritsUserGroup: token.Group == "",
			TokenGroupUsable:  usable,
		})
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

func GetUserGroupsByAdmin(c *gin.Context) {
	user := loadManagedUser(c)
	if user == nil {
		return
	}
	common.ApiSuccess(c, gin.H{
		"user_group": user.Group,
		"groups":     service.GetUserGroupOverview(user.Group),
	})
}

func CheckUserAccessByAdmin(c *gin.Context) {
	user := loadManagedUser(c)
	if user == nil {
		return
	}
	modelName := strings.TrimSpace(c.Query("model"))
	if modelName == "" {
		common.ApiErrorT(c, "Model name is required")
		return
	}
	input := service.AccessCheckInput{User: user, Model: modelName}
	if raw := c.Query("token_id"); raw != "" {
		tokenID, err := strconv.Atoi(raw)
		if err != nil || tokenID <= 0 {
			common.ApiErrorT(c, "Invalid parameters")
			return
		}
		token, err := model.GetTokenByIds(tokenID, user.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		input.Token = token
	}
	if group, ok := c.GetQuery("group"); ok {
		input.GroupOverride = strings.TrimSpace(group)
		input.HasOverride = true
	}
	common.ApiSuccess(c, service.CheckUserModelAccess(input))
}

type adminTokenGroupRequest struct {
	Group string `json:"group"`
}

// UpdateUserTokenGroupByAdmin moves one token of the user to another group the
// user may select, or back to the user group with an empty group. Moving to
// auto is left to the token owner, who also chooses the auto group list.
func UpdateUserTokenGroupByAdmin(c *gin.Context) {
	user := loadManagedUser(c)
	if user == nil {
		return
	}
	tokenID, err := strconv.Atoi(c.Param("token_id"))
	if err != nil || tokenID <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	var request adminTokenGroupRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	group := strings.TrimSpace(request.Group)
	if group != "" && !service.IsUserSelectableGroup(user.Group, group) {
		common.ApiErrorT(c, "Group {{group}} is not available to this user", map[string]any{"group": group})
		return
	}
	token, err := model.GetTokenByIds(tokenID, user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// The group sets the ratio the user is billed at, so moving a token is
	// verified like other changes an administrator makes to the account.
	authorization := requireAdminUserProof(c, service.VerificationScopeAdminUserUpdate, service.AdminUserContext{UserID: user.Id})
	if authorization == nil {
		return
	}
	previous := token.Group
	if previous != group {
		token.Group = group
		token.CrossGroupRetry = false
		_ = token.SetAutoGroups(nil)
		if err := token.Update(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	recordManageAuditFor(c, user.Id, "user.token_group_update", map[string]any{
		"username":            user.Username,
		"id":                  user.Id,
		"token_id":            token.Id,
		"token_name":          token.Name,
		"from":                previous,
		"to":                  group,
		"verification_method": authorization.Method,
	})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

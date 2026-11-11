package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupUserDetailTest builds a user in group "default" whose only token sets
// no group, and one enabled channel serving "muse-video" in group "Muse": the
// configuration that makes every muse-video request of that user fail with
// "no available channel".
func configureUserDetailGroups(t *testing.T) {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","Muse":"Muse"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"Muse":1}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
}

func setupUserDetailTest(t *testing.T) (*model.User, *model.Token) {
	t.Helper()
	configureUserDetailGroups(t)
	// Ability queries quote the reserved "group" column by dialect.
	initModelListColumnNames(t)

	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}, &model.Log{}, &model.AuditLog{}))
	model.InvalidatePricingCache()
	t.Cleanup(model.InvalidatePricingCache)
	user := &model.User{Id: 120, Username: "fanplus", Password: "password", Group: "default", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Quota: 1000}
	require.NoError(t, db.Create(user).Error)
	token := seedToken(t, db, user.Id, "xc", "sk-user-detail-test-key-000000000000000000000")
	require.NoError(t, db.Model(token).Update("group", "").Error)
	token.Group = ""

	channel := &model.Channel{Id: 14, Name: "Muse", Key: "k", Status: common.ChannelStatusEnabled, Models: "muse-video", Group: "Muse"}
	require.NoError(t, db.Create(channel).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "Muse", Model: "muse-video", ChannelId: channel.Id, Enabled: true}).Error)
	return user, token
}

func performUserDetailRequest(t *testing.T, method string, target string, body any, params gin.Params, handler gin.HandlerFunc) tokenAPIResponse {
	t.Helper()
	ctx, recorder := newAuthenticatedContext(t, method, target, body, 1)
	ctx.Set("role", common.RoleRootUser)
	ctx.Params = params
	handler(ctx)
	require.Equal(t, http.StatusOK, recorder.Code)
	return decodeAPIResponse(t, recorder)
}

func decodeAccessCheck(t *testing.T, response tokenAPIResponse) service.AccessCheckResult {
	t.Helper()
	require.True(t, response.Success, response.Message)
	var result service.AccessCheckResult
	require.NoError(t, common.Unmarshal(response.Data, &result))
	return result
}

func TestCheckUserAccessByAdmin(t *testing.T) {
	user, token := setupUserDetailTest(t)
	params := gin.Params{{Key: "id", Value: strconv.Itoa(user.Id)}}
	tests := []struct {
		name           string
		query          string
		allowed        bool
		effectiveGroup string
		lastStep       string
	}{
		{name: "token without group inherits the user group and has no channel", query: "", allowed: false, effectiveGroup: "default", lastStep: "channels"},
		{name: "simulated token group Muse reaches the channel", query: "&group=Muse", allowed: true, effectiveGroup: "Muse", lastStep: "channels"},
		{name: "simulated group the user may not select is rejected", query: "&group=vip", allowed: false, effectiveGroup: "", lastStep: "group_forbidden"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			target := fmt.Sprintf("/api/user/%d/access_check?model=muse-video&token_id=%d%s", user.Id, token.Id, test.query)
			result := decodeAccessCheck(t, performUserDetailRequest(t, http.MethodGet, target, nil, params, CheckUserAccessByAdmin))
			assert.Equal(t, test.allowed, result.Allowed)
			assert.Equal(t, test.effectiveGroup, result.EffectiveGroup)
			require.NotEmpty(t, result.Steps)
			last := result.Steps[len(result.Steps)-1]
			assert.Equal(t, test.lastStep, last.Key)
			if !test.allowed {
				assert.Equal(t, service.AccessCheckFail, last.Result)
				assert.Equal(t, []string{"Muse"}, result.GroupsWithModel)
			}
		})
	}
}

func TestUpdateUserTokenGroupByAdmin(t *testing.T) {
	configureUserDetailGroups(t)
	_, identity, target := setupAdminUserTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))
	token := &model.Token{UserId: target.Id, Name: "xc", Key: "sk-user-detail-group-key-0000000000000000000", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, model.DB.Create(token).Error)
	params := gin.Params{{Key: "id", Value: strconv.Itoa(target.Id)}, {Key: "token_id", Value: strconv.Itoa(token.Id)}}
	path := fmt.Sprintf("/api/user/%d/tokens/%d/group", target.Id, token.Id)
	storedGroup := func() string {
		stored, err := model.GetTokenById(token.Id)
		require.NoError(t, err)
		return stored.Group
	}

	response := adminUserRequest(http.MethodPut, path, `{"group":"vip"}`, "", identity, common.RoleRootUser, params, UpdateUserTokenGroupByAdmin)
	assert.Contains(t, response.Body.String(), `"success":false`)
	assert.Empty(t, storedGroup(), "a group the user may not select is rejected")

	response = adminUserRequest(http.MethodPut, path, `{"group":"Muse"}`, "", identity, common.RoleRootUser, params, UpdateUserTokenGroupByAdmin)
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Contains(t, response.Body.String(), "SECURITY_PROOF_REQUIRED")
	assert.Empty(t, storedGroup(), "a move without step-up verification changes nothing")

	operation := service.VerificationOperation{Scope: service.VerificationScopeAdminUserUpdate, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, target.Id))}
	proof := issueSecurityEnrollmentProof(t, identity, operation, service.VerificationMethodPassword)
	response = adminUserRequest(http.MethodPut, path, `{"group":"Muse"}`, proof, identity, common.RoleRootUser, params, UpdateUserTokenGroupByAdmin)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), `"success":true`)
	assert.Equal(t, "Muse", storedGroup())
}

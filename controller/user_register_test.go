package controller

import (
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func registerRequest(t *testing.T, body map[string]string) securityEnrollmentResponse {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest("POST", "/api/user/register", strings.NewReader(string(payload)))
	c.Request.Header.Set("Content-Type", "application/json")
	Register(c)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result), response.Body.String())
	return result
}

func setEmailVerificationRequired(t *testing.T, required bool) {
	t.Helper()
	previous := common.EmailVerificationEnabled
	common.EmailVerificationEnabled = required
	t.Cleanup(func() { common.EmailVerificationEnabled = previous })
}

func TestRegisterWithEmailOnlyDerivesUsernameAndConsumesCode(t *testing.T) {
	setupSecurityEnrollmentTest(t)
	setEmailVerificationRequired(t, false)
	common.RegisterVerificationCodeWithKey("mr.bob+tag@example.com", "123456", common.EmailVerificationPurpose)

	result := registerRequest(t, map[string]string{"email": " Mr.Bob+Tag@Example.com ", "password": "sign-up-password", "verification_code": "123456"})
	require.True(t, result.Success, result.Message)

	var user model.User
	require.NoError(t, model.DB.Where("email = ?", "mr.bob+tag@example.com").First(&user).Error)
	assert.Regexp(t, regexp.MustCompile(`^mrbobtag_[a-z0-9]{6}$`), user.Username)
	assert.Equal(t, user.Username, user.DisplayName)

	// The code proved the address once; it cannot create a second account.
	again := registerRequest(t, map[string]string{"email": "mr.bob+tag@example.com", "password": "sign-up-password", "verification_code": "123456"})
	assert.False(t, again.Success)
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Count(&count).Error)
	assert.EqualValues(t, 2, count) // the fixture user and the new account
}

func TestRegisterRejectsUnverifiedEmailSignUp(t *testing.T) {
	for _, test := range []struct {
		name     string
		required bool
		body     map[string]string
	}{
		{"email with wrong code", false, map[string]string{"email": "carol@example.com", "password": "sign-up-password", "verification_code": "000000"}},
		{"email without code", false, map[string]string{"email": "carol@example.com", "password": "sign-up-password"}},
		{"username while verification is required", true, map[string]string{"username": "carol", "password": "sign-up-password"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			setupSecurityEnrollmentTest(t)
			setEmailVerificationRequired(t, test.required)
			common.RegisterVerificationCodeWithKey("carol@example.com", "123456", common.EmailVerificationPurpose)

			result := registerRequest(t, test.body)
			assert.False(t, result.Success)
			var count int64
			require.NoError(t, model.DB.Model(&model.User{}).Where("username = ? OR email = ?", "carol", "carol@example.com").Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestRegisterWithUsernameNeedsNoEmail(t *testing.T) {
	setupSecurityEnrollmentTest(t)
	setEmailVerificationRequired(t, false)

	result := registerRequest(t, map[string]string{"username": "dave", "password": "sign-up-password"})
	require.True(t, result.Success, result.Message)
	var user model.User
	require.NoError(t, model.DB.Where("username = ?", "dave").First(&user).Error)
	assert.Empty(t, user.Email)
}

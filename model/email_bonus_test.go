package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setEmailBonus(t *testing.T, quota int) {
	t.Helper()
	previous := common.QuotaForEmailBind
	common.QuotaForEmailBind = quota
	t.Cleanup(func() { common.QuotaForEmailBind = previous })
}

func createBonusUser(t *testing.T, name string, quota int) *User {
	t.Helper()
	user := &User{Username: name, Password: "password", AffCode: name, Quota: quota}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func userQuota(t *testing.T, id int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("quota").First(&user, id).Error)
	return user.Quota
}

func TestEmailBonusIsGrantedOncePerAddressAndUser(t *testing.T) {
	truncateTables(t)
	setEmailBonus(t, 1000)
	first := createBonusUser(t, "bonus-first", 5)
	second := createBonusUser(t, "bonus-second", 0)

	granted, err := GrantEmailBonus(first.Id, " Alice@Example.com ")
	require.NoError(t, err)
	assert.True(t, granted)
	assert.Equal(t, 1005, userQuota(t, first.Id))

	// The same user binding a different address, the same address again
	// under different case, and another user taking over the address all
	// receive nothing.
	for _, attempt := range []struct {
		userId int
		email  string
	}{
		{first.Id, "other@example.com"},
		{first.Id, "alice@example.com"},
		{second.Id, "ALICE@example.com"},
	} {
		granted, err := GrantEmailBonus(attempt.userId, attempt.email)
		require.NoError(t, err)
		assert.False(t, granted, "user %d with %s", attempt.userId, attempt.email)
	}
	assert.Equal(t, 1005, userQuota(t, first.Id))
	assert.Equal(t, 0, userQuota(t, second.Id))

	var logs []Log
	require.NoError(t, DB.Where("user_id = ? AND type = ?", first.Id, LogTypeSystem).Find(&logs).Error)
	require.Len(t, logs, 1)
}

func TestEmailBonusSurvivesAccountDeletion(t *testing.T) {
	truncateTables(t)
	setEmailBonus(t, 1000)
	first := createBonusUser(t, "bonus-deleted", 0)
	granted, err := GrantEmailBonus(first.Id, "bob@example.com")
	require.NoError(t, err)
	require.True(t, granted)

	require.NoError(t, DB.Unscoped().Delete(&User{}, first.Id).Error)
	again := createBonusUser(t, "bonus-again", 0)
	granted, err = GrantEmailBonus(again.Id, "bob@example.com")
	require.NoError(t, err)
	assert.False(t, granted)
	assert.Equal(t, 0, userQuota(t, again.Id))
}

func TestEmailBonusDisabledOrBlankGrantsNothing(t *testing.T) {
	truncateTables(t)
	user := createBonusUser(t, "bonus-off", 0)

	setEmailBonus(t, 0)
	granted, err := GrantEmailBonus(user.Id, "carol@example.com")
	require.NoError(t, err)
	assert.False(t, granted)

	common.QuotaForEmailBind = 1000
	granted, err = GrantEmailBonus(user.Id, "   ")
	require.NoError(t, err)
	assert.False(t, granted)

	// Turning the bonus off and on again did not use up the address.
	granted, err = GrantEmailBonus(user.Id, "carol@example.com")
	require.NoError(t, err)
	assert.True(t, granted)
	assert.Equal(t, 1000, userQuota(t, user.Id))
}

package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// EmailBonusGrant records the one-time quota given for verifying an email
// address. Each address and each user receive it at most once; the unique
// indexes enforce this even for concurrent requests. Rows are kept when the
// user is deleted, so deleting an account and signing up again with the same
// address does not pay the bonus twice.
type EmailBonusGrant struct {
	Id        int64     `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email" gorm:"type:varchar(64);not null;uniqueIndex"`
	UserId    int       `json:"user_id" gorm:"not null;uniqueIndex"`
	Quota     int       `json:"quota"`
	CreatedAt time.Time `json:"created_at"`
}

func (EmailBonusGrant) TableName() string {
	return "email_bonus_grants"
}

// GrantEmailBonus gives the user QuotaForEmailBind for the verified address,
// unless that address or that user has already received it. It reports
// whether quota was added. A concurrent grant for the same address or user
// makes the insert fail on a unique index, so at most one of them pays.
func GrantEmailBonus(userId int, email string) (bool, error) {
	quota := common.QuotaForEmailBind
	email = NormalizeEmail(email)
	if quota <= 0 || userId == 0 || email == "" {
		return false, nil
	}
	if err := common.ValidateWalletQuota(quota); err != nil {
		return false, err
	}
	granted := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&EmailBonusGrant{}).Where("email = ? OR user_id = ?", email, userId).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}
		if err := tx.Create(&EmailBonusGrant{Email: email, UserId: userId, Quota: quota}).Error; err != nil {
			return err
		}
		result := tx.Model(&User{}).
			Where("id = ? AND quota <= ?", userId, common.MaxWalletQuota-quota).
			Update("quota", gorm.Expr("quota + ?", quota))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("email bonus would exceed the wallet limit")
		}
		granted = true
		return nil
	})
	if err != nil || !granted {
		return false, err
	}
	if err := cacheIncrUserQuota(userId, int64(quota)); err != nil {
		common.SysLog(common.LogText("failed to increase user quota: %s", err.Error()))
	}
	RecordLog(userId, LogTypeSystem, common.NewMessage("Email binding bonus {{quota}}", map[string]any{"quota": logger.FormatQuota(quota)}))
	return true, nil
}

package model

import (
	"github.com/QuantumNous/new-api/common"
)

// Maintenance details live in other_info so the channel table needs no new
// columns: the note is shown to users in the model square and the until
// timestamp (Unix seconds, 0 = not set) is shown as the expected recovery and,
// when auto restore is on, re-enables the channel at that time.
const (
	channelMaintenanceNoteKey  = "maintenance_note"
	channelMaintenanceUntilKey = "maintenance_until"
	channelMaintenanceAutoKey  = "maintenance_auto_restore"
)

// MaxChannelMaintenanceNoteLength bounds the public maintenance note.
const MaxChannelMaintenanceNoteLength = 200

func (channel *Channel) GetMaintenance() (note string, until int64) {
	info := channel.GetOtherInfo()
	note, _ = info[channelMaintenanceNoteKey].(string)
	if value, ok := info[channelMaintenanceUntilKey].(float64); ok && value > 0 {
		until = int64(value)
	}
	return note, until
}

// SetChannelMaintenance puts a channel under maintenance, or updates the note
// and recovery time of one that already is. It reports whether anything was
// written.
func SetChannelMaintenance(channelId int, note string, until int64, autoRestore bool) bool {
	channel, err := GetChannelById(channelId, true)
	if err != nil {
		return false
	}
	info := channel.GetOtherInfo()
	info[channelMaintenanceNoteKey] = note
	info[channelMaintenanceUntilKey] = until
	info[channelMaintenanceAutoKey] = autoRestore && until > 0
	channel.SetOtherInfo(info)
	if err := DB.Model(&Channel{}).Where("id = ?", channelId).Update("other_info", channel.OtherInfo).Error; err != nil {
		common.SysLog(common.LogText("failed to save channel maintenance: channel_id=%d, error=%v", channelId, err))
		return false
	}
	UpdateChannelStatus(channelId, "", common.ChannelStatusMaintenance, "maintenance")
	return true
}

// RestoreExpiredChannelMaintenance enables every auto-restoring maintenance
// channel whose recovery time has passed and returns how many were restored.
func RestoreExpiredChannelMaintenance(now int64) int {
	var channels []*Channel
	if err := DB.Select("id", "other_info").Where("status = ?", common.ChannelStatusMaintenance).Find(&channels).Error; err != nil {
		common.SysLog(common.LogText("failed to load maintenance channels: %v", err))
		return 0
	}
	restored := 0
	for _, channel := range channels {
		_, until := channel.GetMaintenance()
		if auto, _ := channel.GetOtherInfo()[channelMaintenanceAutoKey].(bool); !auto || until <= 0 || until > now {
			continue
		}
		if UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "maintenance finished") {
			restored++
		}
	}
	return restored
}

// appendMaintenanceAbilities adds the abilities of maintenance channels for
// models that no enabled channel serves, so those models stay listed in the
// model square. It returns the maintenance details per such model: the first
// non-empty note and the earliest recovery time across its channels.
func appendMaintenanceAbilities(abilities *[]AbilityWithChannel) map[string]ModelMaintenance {
	var channels []*Channel
	if err := DB.Select("id", "other_info").Where("status = ?", common.ChannelStatusMaintenance).Find(&channels).Error; err != nil || len(channels) == 0 {
		return nil
	}
	channelIDs := make([]int, 0, len(channels))
	for _, channel := range channels {
		channelIDs = append(channelIDs, channel.Id)
	}
	var maintenanceAbilities []AbilityWithChannel
	err := DB.Table("abilities").
		Select("abilities.*, channels.type as channel_type, channels.created_time as channel_created_time").
		Joins("join channels on abilities.channel_id = channels.id").
		Where("abilities.channel_id IN ?", channelIDs).
		Scan(&maintenanceAbilities).Error
	if err != nil {
		common.SysLog(common.LogText("failed to load maintenance abilities: %v", err))
		return nil
	}

	served := make(map[string]struct{}, len(*abilities))
	for _, ability := range *abilities {
		served[ability.Model] = struct{}{}
	}
	byChannel := make(map[int]*Channel, len(channels))
	for _, channel := range channels {
		byChannel[channel.Id] = channel
	}
	result := make(map[string]ModelMaintenance)
	for _, ability := range maintenanceAbilities {
		if _, ok := served[ability.Model]; ok {
			continue
		}
		*abilities = append(*abilities, ability)
		item := result[ability.Model]
		if channel := byChannel[ability.ChannelId]; channel != nil {
			note, until := channel.GetMaintenance()
			if item.Note == "" {
				item.Note = note
			}
			if until > 0 && (item.Until == 0 || until < item.Until) {
				item.Until = until
			}
		}
		result[ability.Model] = item
	}
	return result
}

type ModelMaintenance struct {
	Note  string
	Until int64
}

// GetModelMaintenance reports whether every channel serving the model is
// under maintenance, with the details shown to users.
func GetModelMaintenance(modelName string) (ModelMaintenance, bool) {
	GetPricing()
	modelEnableGroupsLock.RLock()
	defer modelEnableGroupsLock.RUnlock()
	maintenance, ok := modelMaintenanceMap[modelName]
	return maintenance, ok
}

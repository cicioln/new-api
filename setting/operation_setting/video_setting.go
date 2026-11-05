package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// VideoSetting controls how long generated videos stored on this server are
// kept.
type VideoSetting struct {
	// RetentionDays deletes stored videos older than this many days. 0 keeps
	// them permanently.
	RetentionDays int `json:"retention_days"`
}

var videoSetting = VideoSetting{RetentionDays: 0}

func init() {
	config.GlobalConfig.Register("video_setting", &videoSetting)
}

func GetVideoSetting() VideoSetting {
	return videoSetting
}

package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

const (
	DefaultPromptLogRetentionDays = 7
	DefaultPromptLogMaxTextBytes  = 65536
	DefaultPromptLogMaxFileSizeMB = 20
)

// PromptLogSetting controls per-channel user prompt and attachment extraction
// logging. Even when Enabled is true, only channels with
// ChannelOtherSettings.PromptLogEnabled set to true will record prompts.
type PromptLogSetting struct {
	Enabled       bool `json:"enabled"`
	RetentionDays int  `json:"retention_days"`
	MaxTextBytes  int  `json:"max_text_bytes"`
	MaxFileSizeMB int  `json:"max_file_size_mb"`
}

var promptLogSetting = PromptLogSetting{
	Enabled:       true,
	RetentionDays: DefaultPromptLogRetentionDays,
	MaxTextBytes:  DefaultPromptLogMaxTextBytes,
	MaxFileSizeMB: DefaultPromptLogMaxFileSizeMB,
}

func init() {
	config.GlobalConfig.Register("prompt_log_setting", &promptLogSetting)
}

func GetPromptLogSetting() PromptLogSetting {
	s := promptLogSetting
	if s.RetentionDays < 0 {
		s.RetentionDays = 0
	}
	if s.MaxTextBytes <= 0 {
		s.MaxTextBytes = DefaultPromptLogMaxTextBytes
	}
	if s.MaxFileSizeMB <= 0 {
		s.MaxFileSizeMB = DefaultPromptLogMaxFileSizeMB
	}
	return s
}

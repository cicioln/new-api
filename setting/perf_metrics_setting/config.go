package perf_metrics_setting

import "github.com/QuantumNous/new-api/setting/config"

type PerfMetricsSetting struct {
	Enabled       bool   `json:"enabled"`
	FlushInterval int    `json:"flush_interval"`
	BucketTime    string `json:"bucket_time"`
	RetentionDays int    `json:"retention_days"`
	// ProbeEnabled sends a minimal test request for models without recent
	// traffic, so the model square always has status data.
	ProbeEnabled  bool   `json:"probe_enabled"`
	ProbeInterval int    `json:"probe_interval"`
}

var perfMetricsSetting = PerfMetricsSetting{
	Enabled:       true,
	FlushInterval: 5,
	BucketTime:    "hour",
	RetentionDays: 0,
	ProbeEnabled:  false,
	ProbeInterval: 60,
}

func init() {
	config.GlobalConfig.Register("perf_metrics_setting", &perfMetricsSetting)
}

func GetSetting() PerfMetricsSetting {
	return perfMetricsSetting
}

func GetBucketSeconds() int64 {
	switch perfMetricsSetting.BucketTime {
	case "minute":
		return 60
	case "5min":
		return 300
	case "hour":
		return 3600
	default:
		return 3600
	}
}

func GetFlushIntervalMinutes() int {
	if perfMetricsSetting.FlushInterval < 1 {
		return 1
	}
	return perfMetricsSetting.FlushInterval
}

func GetProbeIntervalMinutes() int {
	if perfMetricsSetting.ProbeInterval < 5 {
		return 5
	}
	return perfMetricsSetting.ProbeInterval
}

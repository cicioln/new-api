package rankings_setting

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// Rankings data source modes.
const (
	ModeReal      = "real"      // usage logs only
	ModeSimulated = "simulated" // configured models only
	ModeMixed     = "mixed"     // usage logs plus configured models
)

const (
	maxSimulatedModels    = 200
	maxSimulatedOverrides = 400
	// DateLayout is the format of start/end dates and override keys.
	DateLayout = "2006-01-02"
)

type RankingsSetting struct {
	Mode string `json:"mode"`
	// Models is a JSON array of SimulatedModel.
	Models string `json:"models"`
}

// SimulatedModel is one admin-configured leaderboard entry.
type SimulatedModel struct {
	ModelName string `json:"model_name"`
	// DailyTokens is the average tokens per day; longer periods scale it.
	DailyTokens int64 `json:"daily_tokens"`
	// GrowthPct is the change against the previous period, e.g. 25 or -10.
	GrowthPct float64 `json:"growth_pct"`
	// StartDate and EndDate (inclusive, DateLayout) limit the days the model
	// has usage; empty means unbounded.
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
	// DailyOverrides sets the exact tokens for a date (DateLayout), replacing
	// the daily average and ignoring the start/end dates.
	DailyOverrides map[string]int64 `json:"daily_overrides,omitempty"`
}

// Active reports whether the model has its average usage on day.
func (m SimulatedModel) Active(day string) bool {
	if m.StartDate != "" && day < m.StartDate {
		return false
	}
	if m.EndDate != "" && day > m.EndDate {
		return false
	}
	return true
}

func validDate(value string) bool {
	_, err := time.Parse(DateLayout, value)
	return err == nil
}

var rankingsSetting = RankingsSetting{
	Mode:   ModeReal,
	Models: "[]",
}

func init() {
	config.GlobalConfig.Register("rankings_setting", &rankingsSetting)
}

func GetSetting() RankingsSetting {
	return rankingsSetting
}

// GetSimulatedModels returns the valid configured models; invalid entries are
// skipped so a bad row never breaks the public rankings page.
func GetSimulatedModels() []SimulatedModel {
	models, _ := ParseSimulatedModels(rankingsSetting.Models)
	return models
}

func ParseSimulatedModels(raw string) ([]SimulatedModel, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	var items []SimulatedModel
	if err := common.UnmarshalJsonStr(raw, &items); err != nil {
		return nil, fmt.Errorf("simulated models must be a JSON array: %w", err)
	}
	result := make([]SimulatedModel, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item.ModelName = strings.TrimSpace(item.ModelName)
		if item.StartDate != "" && !validDate(item.StartDate) {
			item.StartDate = ""
		}
		if item.EndDate != "" && !validDate(item.EndDate) {
			item.EndDate = ""
		}
		for day, tokens := range item.DailyOverrides {
			if !validDate(day) || tokens < 0 {
				delete(item.DailyOverrides, day)
			}
		}
		if item.DailyTokens < 0 {
			item.DailyTokens = 0
		}
		if item.ModelName == "" || item.GrowthPct <= -100 || (item.DailyTokens == 0 && len(item.DailyOverrides) == 0) {
			continue
		}
		if _, ok := seen[item.ModelName]; ok {
			continue
		}
		seen[item.ModelName] = struct{}{}
		result = append(result, item)
	}
	return result, nil
}

// ValidateModels checks the option value an admin submits.
func ValidateModels(raw string) error {
	var items []SimulatedModel
	if err := common.UnmarshalJsonStr(strings.TrimSpace(raw), &items); err != nil {
		return fmt.Errorf("simulated models must be a JSON array: %w", err)
	}
	if len(items) > maxSimulatedModels {
		return fmt.Errorf("at most %d simulated models are allowed", maxSimulatedModels)
	}
	seen := make(map[string]struct{}, len(items))
	for i, item := range items {
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			return fmt.Errorf("row %d: model name is required", i+1)
		}
		if _, ok := seen[name]; ok {
			return fmt.Errorf("row %d: duplicate model %s", i+1, name)
		}
		seen[name] = struct{}{}
		if item.DailyTokens < 0 || (item.DailyTokens == 0 && len(item.DailyOverrides) == 0) {
			return fmt.Errorf("row %d: daily tokens must be greater than 0", i+1)
		}
		if item.StartDate != "" && !validDate(item.StartDate) {
			return fmt.Errorf("row %d: invalid start date %s", i+1, item.StartDate)
		}
		if item.EndDate != "" && !validDate(item.EndDate) {
			return fmt.Errorf("row %d: invalid end date %s", i+1, item.EndDate)
		}
		if item.StartDate != "" && item.EndDate != "" && item.StartDate > item.EndDate {
			return fmt.Errorf("row %d: start date must not be after end date", i+1)
		}
		if len(item.DailyOverrides) > maxSimulatedOverrides {
			return fmt.Errorf("row %d: at most %d dated values are allowed", i+1, maxSimulatedOverrides)
		}
		for day, tokens := range item.DailyOverrides {
			if !validDate(day) {
				return fmt.Errorf("row %d: invalid date %s", i+1, day)
			}
			if tokens < 0 {
				return fmt.Errorf("row %d: tokens on %s must not be negative", i+1, day)
			}
		}
		if item.GrowthPct <= -100 || item.GrowthPct > 10000 {
			return fmt.Errorf("row %d: growth must be between -100%% and 10000%%", i+1)
		}
	}
	return nil
}

func ValidateMode(mode string) error {
	switch mode {
	case ModeReal, ModeSimulated, ModeMixed:
		return nil
	default:
		return fmt.Errorf("invalid rankings mode: %s", mode)
	}
}

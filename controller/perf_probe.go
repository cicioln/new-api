package controller

import (
	"context"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

// perfProbeSkipKeywords excludes models whose test request is costly or not a
// chat call (image/video/audio generation).
var perfProbeSkipKeywords = []string{"image", "dall-e", "seedream", "sora", "veo", "video", "tts", "whisper", "midjourney", "suno"}

type perfProbeTarget struct {
	modelName string
	channelId int
	groups    []string
}

// StartPerfProbe periodically sends a minimal test request for every model
// without recent real traffic and records the result as a perf sample, so the
// model square shows status, latency and throughput for idle models too.
func StartPerfProbe() {
	for {
		time.Sleep(time.Duration(perf_metrics_setting.GetProbeIntervalMinutes()) * time.Minute)
		setting := perf_metrics_setting.GetSetting()
		if !common.IsMasterNode || !setting.Enabled || !setting.ProbeEnabled {
			continue
		}
		runPerfProbe(time.Duration(perf_metrics_setting.GetProbeIntervalMinutes()) * time.Minute)
	}
}

func runPerfProbe(within time.Duration) {
	testUserID, err := resolveChannelTestUserID(nil)
	if err != nil {
		common.SysError(common.LogText("perf probe: %s", err.Error()))
		return
	}
	targets, err := collectPerfProbeTargets()
	if err != nil {
		common.SysError(common.LogText("perf probe: failed to load abilities: %s", err.Error()))
		return
	}
	probed := 0
	for _, target := range targets {
		if perfmetrics.HasRecentTraffic(target.modelName, within) {
			continue
		}
		channel, err := model.CacheGetChannel(target.channelId)
		if err != nil || channel.Status != common.ChannelStatusEnabled {
			continue
		}
		probePerfTarget(channel, target, testUserID)
		probed++
	}
	common.SysLog(common.LogText("perf probe done: %d probed", probed))
}

// collectPerfProbeTargets picks the highest-priority enabled channel for each
// model/group pair, then merges pairs served by the same channel so each
// model is tested once per channel.
func collectPerfProbeTargets() ([]*perfProbeTarget, error) {
	abilities, err := model.GetAllEnableAbilityWithChannels()
	if err != nil {
		return nil, err
	}
	type pairKey struct{ model, group string }
	best := make(map[pairKey]model.AbilityWithChannel)
	for _, ability := range abilities {
		if shouldSkipPerfProbeModel(ability.Model) {
			continue
		}
		key := pairKey{ability.Model, ability.Group}
		current, ok := best[key]
		if !ok || abilityPriority(ability) > abilityPriority(current) {
			best[key] = ability
		}
	}
	type targetKey struct {
		model     string
		channelId int
	}
	byChannel := make(map[targetKey]*perfProbeTarget)
	targets := make([]*perfProbeTarget, 0, len(best))
	for key, ability := range best {
		tk := targetKey{key.model, ability.ChannelId}
		target, ok := byChannel[tk]
		if !ok {
			target = &perfProbeTarget{modelName: key.model, channelId: ability.ChannelId}
			byChannel[tk] = target
			targets = append(targets, target)
		}
		target.groups = append(target.groups, key.group)
	}
	return targets, nil
}

func probePerfTarget(channel *model.Channel, target *perfProbeTarget, testUserID int) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	tik := time.Now()
	result := testChannel(ctx, channel, testUserID, target.modelName, "", shouldUseStreamForAutomaticChannelTest(channel))
	latencyMs := time.Since(tik).Milliseconds()
	// A local error without an API error means the test never reached the
	// upstream (unsupported channel type, missing user), so it says nothing
	// about the model's health.
	if result.newAPIError == nil && result.localErr != nil {
		return
	}
	success := result.newAPIError == nil
	for _, group := range target.groups {
		sample := perfmetrics.Sample{
			Model:     target.modelName,
			Group:     group,
			LatencyMs: latencyMs,
			Success:   success,
			Probe:     true,
		}
		if success && result.completionTokens > 0 {
			sample.OutputTokens = int64(result.completionTokens)
			sample.GenerationMs = latencyMs
		}
		perfmetrics.Record(sample)
	}
}

func shouldSkipPerfProbeModel(modelName string) bool {
	lower := strings.ToLower(modelName)
	for _, keyword := range perfProbeSkipKeywords {
		if strings.Contains(lower, keyword) {
			return true
		}
	}
	return false
}

func abilityPriority(ability model.AbilityWithChannel) int64 {
	if ability.Priority == nil {
		return 0
	}
	return *ability.Priority
}

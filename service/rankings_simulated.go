package service

import (
	"hash/fnv"
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/rankings_setting"
)

// Admin-configured rankings data. Each model has an average daily token count
// and a growth against the previous period. Usage is laid out in slots (hours
// for today, days otherwise) that ramp from the previous rate to the current
// one with a small, stable wobble so the charts look natural. Start/end dates
// limit the days a model has usage, and dated values replace a day's tokens
// exactly. Days are UTC dates, matching the daily chart buckets.

const (
	rankingSimulatedWobble = 0.12
	rankingDaySeconds      = int64(24 * 3600)
)

type simulatedRankingData struct {
	current  []model.RankingQuotaTotal
	previous []model.RankingQuotaTotal
	buckets  []model.RankingQuotaBucket
}

func simulateRankingData(models []rankings_setting.SimulatedModel, config rankingPeriodConfig, endTime int64) simulatedRankingData {
	data := simulatedRankingData{}
	if len(models) == 0 {
		return data
	}
	slotSize := min(config.bucketSize, rankingDaySeconds)
	if slotSize <= 0 {
		return data
	}
	slotCount := int64(config.duration.Seconds()) / slotSize
	if slotCount <= 0 {
		return data
	}
	// The current window is the last slotCount slots ending with the one that
	// holds endTime; the previous window is the same length right before it.
	lastSlot := endTime / slotSize * slotSize
	currentStart := lastSlot - (slotCount-1)*slotSize
	previousStart := currentStart - slotCount*slotSize
	for _, item := range models {
		current, buckets := simulateCurrentSlots(item, config, currentStart, slotSize, slotCount)
		if current > 0 {
			data.current = append(data.current, model.RankingQuotaTotal{ModelName: item.ModelName, TotalTokens: current})
			data.buckets = append(data.buckets, buckets...)
		}
		if config.hasPrevious {
			if previous := simulatePreviousSlots(item, previousStart, slotSize, slotCount); previous > 0 {
				data.previous = append(data.previous, model.RankingQuotaTotal{ModelName: item.ModelName, TotalTokens: previous})
			}
		}
	}
	return data
}

// simulateCurrentSlots returns the model's total over the current window and
// its tokens grouped into chart buckets.
func simulateCurrentSlots(item rankings_setting.SimulatedModel, config rankingPeriodConfig, start, slotSize, slotCount int64) (int64, []model.RankingQuotaBucket) {
	// The rate at the start of the window relative to the end: a model that
	// grew 50% started at 1/1.5 of today's rate. Weights are normalized to a
	// mean of 1 so the window averages the configured daily tokens.
	startRate := 1 / (1 + item.GrowthPct/100)
	weights := make([]float64, slotCount)
	sum := 0.0
	for i := range weights {
		progress := 1.0
		if slotCount > 1 {
			progress = float64(i) / float64(slotCount-1)
		}
		slot := start + int64(i)*slotSize
		weights[i] = (startRate + (1-startRate)*progress) * rankingWobble(item.ModelName, slot)
		sum += weights[i]
	}
	mean := sum / float64(slotCount)
	byBucket := make(map[int64]int64)
	order := make([]int64, 0)
	total := int64(0)
	for i, weight := range weights {
		slot := start + int64(i)*slotSize
		if mean > 0 {
			weight /= mean
		}
		tokens := simulatedSlotTokens(item, slot, slotSize, weight)
		if tokens <= 0 {
			continue
		}
		bucket := slot / config.bucketSize * config.bucketSize
		if _, ok := byBucket[bucket]; !ok {
			order = append(order, bucket)
		}
		byBucket[bucket] += tokens
		total += tokens
	}
	rows := make([]model.RankingQuotaBucket, 0, len(order))
	for _, bucket := range order {
		rows = append(rows, model.RankingQuotaBucket{ModelName: item.ModelName, Bucket: bucket, Tokens: byBucket[bucket]})
	}
	return total, rows
}

// simulatePreviousSlots returns the model's total over the previous window,
// flat at the previous rate.
func simulatePreviousSlots(item rankings_setting.SimulatedModel, start, slotSize, slotCount int64) int64 {
	startRate := 1 / (1 + item.GrowthPct/100)
	total := int64(0)
	for i := int64(0); i < slotCount; i++ {
		slot := start + i*slotSize
		total += simulatedSlotTokens(item, slot, slotSize, startRate*rankingWobble(item.ModelName, slot))
	}
	return total
}

// simulatedSlotTokens is the tokens in one slot: a dated value split evenly
// over the day, nothing outside the start/end dates, else the daily average
// scaled by weight.
func simulatedSlotTokens(item rankings_setting.SimulatedModel, slot, slotSize int64, weight float64) int64 {
	share := float64(slotSize) / float64(rankingDaySeconds)
	day := time.Unix(slot, 0).UTC().Format(rankings_setting.DateLayout)
	if tokens, ok := item.DailyOverrides[day]; ok {
		return int64(math.Round(float64(tokens) * share))
	}
	if !item.Active(day) || weight <= 0 {
		return 0
	}
	return int64(math.Round(float64(item.DailyTokens) * share * weight))
}

// rankingWobble is a stable multiplier around 1 for a model and slot.
func rankingWobble(modelName string, slot int64) float64 {
	return max(0, 1+rankingSimulatedWobble*rankingNoise(modelName, slot))
}

// rankingNoise returns a stable value in [-1, 1] for a model and bucket, so
// the charts do not change on every refresh.
func rankingNoise(modelName string, bucket int64) float64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(modelName))
	var b [8]byte
	for i := range b {
		b[i] = byte(bucket >> (8 * i))
	}
	_, _ = h.Write(b[:])
	return float64(h.Sum64()%2001)/1000 - 1
}

// mergeRankingTotals adds simulated totals to real ones by model name and
// keeps the descending order the ranking code expects.
func mergeRankingTotals(real, simulated []model.RankingQuotaTotal) []model.RankingQuotaTotal {
	if len(simulated) == 0 {
		return real
	}
	index := make(map[string]int, len(real)+len(simulated))
	merged := make([]model.RankingQuotaTotal, 0, len(real)+len(simulated))
	for _, rows := range [][]model.RankingQuotaTotal{real, simulated} {
		for _, row := range rows {
			if i, ok := index[row.ModelName]; ok {
				merged[i].TotalTokens += row.TotalTokens
				continue
			}
			index[row.ModelName] = len(merged)
			merged = append(merged, row)
		}
	}
	sort.SliceStable(merged, func(i, j int) bool {
		return merged[i].TotalTokens > merged[j].TotalTokens
	})
	return merged
}

package service

import (
	"hash/fnv"
	"math"
	"sort"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/rankings_setting"
)

// Admin-configured rankings data. Each model has an average daily token count
// and a growth against the previous period; the period total scales with its
// length and the hourly/daily buckets ramp from the previous rate to the
// current one with a small, stable wobble so the charts look natural.

const rankingSimulatedWobble = 0.12

type simulatedRankingData struct {
	current  []model.RankingQuotaTotal
	previous []model.RankingQuotaTotal
	buckets  []model.RankingQuotaBucket
}

func simulateRankingData(models []rankings_setting.SimulatedModel, config rankingPeriodConfig, startTime, endTime int64) simulatedRankingData {
	data := simulatedRankingData{}
	if len(models) == 0 {
		return data
	}
	days := config.duration.Hours() / 24
	buckets := rankingBucketStarts(startTime, endTime, config.bucketSize)
	for _, item := range models {
		current := int64(math.Round(float64(item.DailyTokens) * days))
		if current <= 0 {
			continue
		}
		data.current = append(data.current, model.RankingQuotaTotal{ModelName: item.ModelName, TotalTokens: current})
		if config.hasPrevious {
			previous := int64(math.Round(float64(current) / (1 + item.GrowthPct/100)))
			if previous > 0 {
				data.previous = append(data.previous, model.RankingQuotaTotal{ModelName: item.ModelName, TotalTokens: previous})
			}
		}
		data.buckets = append(data.buckets, simulateRankingBuckets(item, current, buckets)...)
	}
	return data
}

// rankingBucketStarts lists the bucket starts covering [startTime, endTime],
// aligned the same way the quota_data aggregation aligns them.
func rankingBucketStarts(startTime, endTime, bucketSize int64) []int64 {
	if bucketSize <= 0 || endTime < startTime {
		return nil
	}
	first := startTime / bucketSize * bucketSize
	starts := make([]int64, 0, (endTime-first)/bucketSize+1)
	for bucket := first; bucket <= endTime; bucket += bucketSize {
		starts = append(starts, bucket)
	}
	return starts
}

func simulateRankingBuckets(item rankings_setting.SimulatedModel, total int64, buckets []int64) []model.RankingQuotaBucket {
	if len(buckets) == 0 {
		return nil
	}
	// The rate at the start of the period relative to the end: a model that
	// grew 50% started at 1/1.5 of today's rate.
	startRate := 1 / (1 + item.GrowthPct/100)
	weights := make([]float64, len(buckets))
	sum := 0.0
	for i, bucket := range buckets {
		progress := 1.0
		if len(buckets) > 1 {
			progress = float64(i) / float64(len(buckets)-1)
		}
		trend := startRate + (1-startRate)*progress
		weights[i] = trend * (1 + rankingSimulatedWobble*rankingNoise(item.ModelName, bucket))
		if weights[i] < 0 {
			weights[i] = 0
		}
		sum += weights[i]
	}
	if sum <= 0 {
		return nil
	}
	rows := make([]model.RankingQuotaBucket, 0, len(buckets))
	allocated := int64(0)
	for i, bucket := range buckets {
		tokens := int64(math.Floor(float64(total) * weights[i] / sum))
		if i == len(buckets)-1 {
			tokens = total - allocated
		}
		allocated += tokens
		if tokens > 0 {
			rows = append(rows, model.RankingQuotaBucket{ModelName: item.ModelName, Bucket: bucket, Tokens: tokens})
		}
	}
	return rows
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

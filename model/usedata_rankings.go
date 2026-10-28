package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type RankingQuotaTotal struct {
	ModelName   string `json:"model_name"`
	TotalTokens int64  `json:"total_tokens"`
}

type RankingQuotaBucket struct {
	ModelName string `json:"model_name"`
	Bucket    int64  `json:"bucket"`
	Tokens    int64  `json:"tokens"`
}

func GetRankingQuotaTotals(startTime int64, endTime int64) ([]RankingQuotaTotal, error) {
	var rows []RankingQuotaTotal
	query := DB.Table("quota_data").
		Select("model_name, sum(token_used) as total_tokens").
		Where("model_name <> ''").
		Group("model_name").
		Having("sum(token_used) > 0").
		Order("total_tokens DESC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

func GetRankingQuotaBuckets(startTime int64, endTime int64, bucketSize int64) ([]RankingQuotaBucket, error) {
	if bucketSize <= 0 {
		bucketSize = 3600
	}
	bucketExpr := rankingBucketExpr(bucketSize)
	var rows []RankingQuotaBucket
	query := DB.Table("quota_data").
		Select(fmt.Sprintf("model_name, %s as bucket, sum(token_used) as tokens", bucketExpr)).
		Where("model_name <> ''").
		Group(fmt.Sprintf("model_name, %s", bucketExpr)).
		Having("sum(token_used) > 0").
		Order("bucket ASC")
	query = applyRankingQuotaTimeRange(query, startTime, endTime)
	err := query.Find(&rows).Error
	return rows, err
}

// ResolveRankingVendors resolves vendors for logged model names, which may be
// mapping aliases or models no longer listed in any channel. Order: model
// metadata (exact/prefix/suffix/contains) on the name, metadata on its
// channel model_mapping target, then the default name rules.
func ResolveRankingVendors(names []string) map[string]PricingVendor {
	var allMeta []Model
	_ = DB.Find(&allMeta).Error
	var vendors []Vendor
	_ = DB.Find(&vendors).Error
	vendorMap := make(map[int]*Vendor, len(vendors))
	for i := range vendors {
		vendorMap[vendors[i].Id] = &vendors[i]
	}

	aliasTargets := loadRankingAliasTargets()
	lookup := make([]string, 0, len(names)*2)
	lookup = append(lookup, names...)
	for _, name := range names {
		if target, ok := aliasTargets[name]; ok {
			lookup = append(lookup, target)
		}
	}
	metaMap := resolveModelMetadata(allMeta, lookup)

	patterns := sortedDefaultVendorPatterns()
	vendorFor := func(name string) *Vendor {
		if meta, ok := metaMap[name]; ok && meta.VendorID != 0 {
			if v, ok := vendorMap[meta.VendorID]; ok {
				return v
			}
		}
		return nil
	}

	result := make(map[string]PricingVendor, len(names))
	for _, name := range names {
		v := vendorFor(name)
		if v == nil {
			if target, ok := aliasTargets[name]; ok {
				v = vendorFor(target)
			}
		}
		if v == nil {
			candidate := name
			if target, ok := aliasTargets[name]; ok {
				candidate = target
			}
			if id := defaultVendorIDForModel(candidate, patterns, vendorMap); id != 0 {
				v = vendorMap[id]
			}
		}
		if v != nil {
			icon := v.Icon
			if icon == "" {
				icon = getDefaultVendorIcon(v.Name)
			}
			result[name] = PricingVendor{ID: v.Id, Name: v.Name, Icon: icon}
		}
	}
	return result
}

func loadRankingAliasTargets() map[string]string {
	targets := make(map[string]string)
	var channels []Channel
	if err := DB.Select("id", "model_mapping").Find(&channels).Error; err != nil {
		return targets
	}
	for i := range channels {
		mappingJSON := channels[i].GetModelMapping()
		if mappingJSON == "" || mappingJSON == "{}" {
			continue
		}
		modelMap := make(map[string]string)
		if err := common.UnmarshalJsonStr(mappingJSON, &modelMap); err != nil {
			continue
		}
		for alias := range modelMap {
			if _, exists := targets[alias]; exists {
				continue
			}
			if target, cyclic := followChannelModelMapping(modelMap, alias); !cyclic && target != "" && target != alias {
				targets[alias] = target
			}
		}
	}
	return targets
}

func rankingBucketExpr(bucketSize int64) string {
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		return fmt.Sprintf("FLOOR(created_at / %d) * %d", bucketSize, bucketSize)
	}
	return fmt.Sprintf("(created_at / %d) * %d", bucketSize, bucketSize)
}

func applyRankingQuotaTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}

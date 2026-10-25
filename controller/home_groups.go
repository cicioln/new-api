package controller

import (
	"cmp"
	"maps"
	"net/http"
	"slices"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type homeGroup struct {
	Group        string   `json:"group"`
	Desc         string   `json:"desc"`
	Ratio        float64  `json:"ratio"`
	ModelCount   int      `json:"model_count"`
	SuccessRate  *float64 `json:"success_rate"`
	AvgLatencyMs *int64   `json:"avg_latency_ms"`
	AvgTps       *float64 `json:"avg_tps"`
}

// GetHomeGroups lists the viewer's usable groups with ratio, model count and
// recent performance. Request counts are never exposed.
func GetHomeGroups(c *gin.Context) {
	hours := 1
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	groupRatio := map[string]float64{}
	maps.Copy(groupRatio, ratio_setting.GetGroupRatioCopy())
	var userGroup string
	if userId, exists := c.Get("id"); exists {
		if user, err := model.GetUserCache(userId.(int)); err == nil {
			userGroup = user.Group
			for g := range groupRatio {
				if ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, g); ok {
					groupRatio[g] = ratio
				}
			}
		}
	}
	usableGroup := service.GetUserUsableGroups(userGroup)
	maps.DeleteFunc(groupRatio, func(g string, _ float64) bool {
		_, ok := usableGroup[g]
		return !ok
	})

	groupNames := slices.Collect(maps.Keys(groupRatio))
	// An empty allow-list still yields the window but no per-group metrics.
	perfGroups := []string{}
	if perf_metrics_setting.GetSetting().Enabled && len(groupNames) > 0 {
		perfGroups = groupNames
	}
	perf, err := perfmetrics.QueryGroupSummary(hours, perfGroups)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pricing := model.GetPricing()
	groups := make([]homeGroup, 0, len(groupNames))
	for _, name := range groupNames {
		item := homeGroup{Group: name, Desc: usableGroup[name], Ratio: groupRatio[name]}
		for _, p := range pricing {
			if slices.Contains(p.EnableGroup, name) || slices.Contains(p.EnableGroup, "all") {
				item.ModelCount++
			}
		}
		if summary, ok := perf.Groups[name]; ok {
			item.SuccessRate = &summary.SuccessRate
			item.AvgLatencyMs = &summary.AvgLatencyMs
			item.AvgTps = &summary.AvgTps
		}
		groups = append(groups, item)
	}
	slices.SortFunc(groups, func(a, b homeGroup) int {
		return cmp.Or(cmp.Compare(a.Ratio, b.Ratio), cmp.Compare(a.Group, b.Group))
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"window_start": perf.WindowStart,
			"window_end":   perf.WindowEnd,
			"groups":       groups,
		},
	})
}

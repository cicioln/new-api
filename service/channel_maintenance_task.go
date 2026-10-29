package service

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

// 渠道维护到期自动恢复：只在主节点运行，每分钟把恢复时间已到的维护中渠道重新启用。

const channelMaintenanceTickInterval = time.Minute

var channelMaintenanceTaskOnce sync.Once

func StartChannelMaintenanceRestoreTask() {
	channelMaintenanceTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(channelMaintenanceTickInterval)
			defer ticker.Stop()
			for range ticker.C {
				if restored := model.RestoreExpiredChannelMaintenance(time.Now().Unix()); restored > 0 {
					common.SysLog(common.LogText("restored %d channel(s) from maintenance", restored))
					model.InitChannelCache()
				}
			}
		})
	})
}

package middleware

import (
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// A request the distributor rejects never reaches a channel, so the relay
// error log never sees it. Recording it as an error log lets administrators
// and the user find "no available channel" and similar rejections in the log
// pages. The same rejection is recorded at most once a minute per user, token,
// group and model, so a client retrying in a loop cannot fill the log table.

const distributorRejectLogInterval int64 = 60

// distributorRejectLogLimit bounds the dedupe map; older keys are dropped
// when it is exceeded.
const distributorRejectLogLimit = 10000

var (
	distributorRejectLogMu   sync.Mutex
	distributorRejectLogSeen = map[string]int64{}
)

func shouldRecordDistributorRejection(key string, now int64) bool {
	distributorRejectLogMu.Lock()
	defer distributorRejectLogMu.Unlock()
	if last, ok := distributorRejectLogSeen[key]; ok && now-last < distributorRejectLogInterval {
		return false
	}
	if len(distributorRejectLogSeen) >= distributorRejectLogLimit {
		for seenKey, last := range distributorRejectLogSeen {
			if now-last >= distributorRejectLogInterval {
				delete(distributorRejectLogSeen, seenKey)
			}
		}
		if len(distributorRejectLogSeen) >= distributorRejectLogLimit {
			distributorRejectLogSeen = map[string]int64{}
		}
	}
	distributorRejectLogSeen[key] = now
	return true
}

func recordDistributorRejection(c *gin.Context, statusCode int, modelName string, message string) {
	userId := c.GetInt("id")
	if userId <= 0 || model.LOG_DB == nil {
		return
	}
	tokenId := c.GetInt("token_id")
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	key := fmt.Sprintf("%d|%d|%s|%s|%d", userId, tokenId, group, modelName, statusCode)
	if !shouldRecordDistributorRejection(key, common.GetTimestamp()) {
		return
	}
	other := model.NewLogOther()
	if c.Request != nil && c.Request.URL != nil {
		other.SetPublic("request_path", c.Request.URL.Path)
	}
	other.SetPublic("error_type", "distributor_rejected")
	other.SetPublic("status_code", statusCode)
	model.RecordErrorLog(c, userId, 0, modelName, c.GetString("token_name"), message, tokenId, 0, false, group, other)
}

package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The design's "Search action or IP" box sends keyword. It must match the
// IP, action key and content as literal text on every supported engine.
func TestAuditLogsFilterByKeyword(t *testing.T) {
	db, dialect := openTaskDialectDatabase(t, &model.AuditLog{})
	previousLogDB := model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	model.LOG_DB = db
	common.SetDatabaseTypes(dialect, dialect)
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
	})
	for i, entry := range []model.AuditLog{
		{Ip: "203.0.113.24", Action: "token.create", Content: "Created token"},
		{Ip: "198.51.100.7", Action: "user.login", Content: "Signed in"},
		{Ip: "192.0.2.1", Action: "setting.update", Content: "100% done_now"},
	} {
		entry.ActorRole = common.RoleCommonUser
		entry.UserId = 1
		entry.CreatedAt = int64(100 + i)
		entry.Category = model.AuditCategoryOperation
		entry.EventId = entry.Action
		entry.Username = "owner"
		// The harness prefixes table names, so insert through the model.
		require.NoError(t, db.Create(&entry).Error)
	}

	router := gin.New()
	router.GET("/api/audit", func(c *gin.Context) {
		c.Set("role", common.RoleRootUser)
		GetAuditLogs(c)
	})
	search := func(keyword string) []string {
		t.Helper()
		logs, _, err := model.GetAuditLogs(model.AuditLogFilter{Keyword: keyword}, 0, 10, common.RoleRootUser)
		require.NoError(t, err)
		actions := make([]string, 0, len(logs))
		for _, entry := range logs {
			actions = append(actions, entry.Action)
		}
		return actions
	}
	assert.Equal(t, []string{"token.create"}, search("203.0.113"))
	assert.Equal(t, []string{"user.login"}, search("login"))
	assert.Equal(t, []string{"token.create"}, search("Created"))
	// Wildcards in the input are literal characters, not patterns.
	assert.Equal(t, []string{"setting.update"}, search("100%"))
	assert.Equal(t, []string{"setting.update"}, search("done_now"))
	assert.Empty(t, search("_"+"x"))
	assert.Empty(t, search("!"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/audit?keyword=%20login%20", nil))
	assert.Contains(t, recorder.Body.String(), `"user.login"`)
	assert.NotContains(t, recorder.Body.String(), `"token.create"`)
	recorder = httptest.NewRecorder()
	long := make([]byte, 129)
	for i := range long {
		long[i] = 'a'
	}
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/audit?keyword="+string(long), nil))
	assert.Contains(t, recorder.Body.String(), "Invalid audit filters")
}

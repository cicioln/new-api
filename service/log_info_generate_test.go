package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendStreamStatus_MissingTerminalIsError(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	status.RequireTerminal()

	other := model.NewLogOther()
	appendStreamStatus(&relaycommon.RelayInfo{
		IsStream:     true,
		StreamStatus: status,
	}, other)

	raw, ok := other.Snapshot()["stream_status"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "error", raw["status"])
	assert.Equal(t, "eof", raw["end_reason"])
}

func TestAppendStreamStatus_CompletedTerminalIsOK(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(relaycommon.StreamEndReasonEOF, nil)
	status.RequireTerminal()
	status.MarkCompleted()

	other := model.NewLogOther()
	appendStreamStatus(&relaycommon.RelayInfo{
		IsStream:     true,
		StreamStatus: status,
	}, other)

	raw, ok := other.Snapshot()["stream_status"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "ok", raw["status"])
	assert.Equal(t, "completed", raw["response_status"])
}

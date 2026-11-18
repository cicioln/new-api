package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

const VideoTaskTerminatedReason = "Video task terminated by administrator"

var (
	ErrTaskAlreadyFinished = errors.New("Task is already finished")
	ErrTaskStatusChanged   = errors.New("Task status changed; refresh and try again")
	ErrNotVideoTask        = errors.New("Only video tasks can be terminated")
)

// TerminateVideoTask uses the same status CAS as polling. Only its winner may
// refund; a late upstream response cannot overwrite the terminal state.
func TerminateVideoTask(ctx context.Context, task *model.Task) error {
	switch constant.NormalizeTaskAction(task.Action) {
	case constant.TaskActionTextToVideo, constant.TaskActionImageToVideo, constant.TaskActionFirstTailToVideo, constant.TaskActionReferenceToVideo, constant.TaskActionRemix:
	default:
		return ErrNotVideoTask
	}
	if task.Status == model.TaskStatusFailure && task.FailReason == VideoTaskTerminatedReason {
		return nil // repeated requests must never refund twice
	}
	if !isNonTerminalPollStatus(task.Status) && task.Status != model.TaskStatusUnknown {
		return ErrTaskAlreadyFinished
	}
	previous := task.Status
	task.Status, task.Progress, task.FailReason = model.TaskStatusFailure, "100%", VideoTaskTerminatedReason
	task.FinishTime = time.Now().Unix()
	var data map[string]any
	_ = common.Unmarshal(task.Data, &data)
	if data == nil {
		data = map[string]any{}
	}
	data["status"], data["stage"], data["code"], data["reason"] = model.TaskStatusFailure, "canceled", "admin_terminated", VideoTaskTerminatedReason
	task.SetData(data)
	won, err := task.UpdateWithStatus(previous)
	if err != nil {
		return err
	}
	if !won {
		return ErrTaskStatusChanged
	}
	RefundTaskQuota(ctx, task, VideoTaskTerminatedReason)
	return nil
}

func CoverTaskActionToModelName(platform constant.TaskPlatform, action string) string {
	return strings.ToLower(string(platform)) + "_" + strings.ToLower(action)
}

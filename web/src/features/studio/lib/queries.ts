/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'

import { TASK_STATUS } from '@/features/usage-logs/constants'

import { getImageJobs, getVideoTasks } from '../api'

export const IMAGE_JOBS_KEY = ['studio-image-jobs']
export const VIDEO_TASKS_KEY = ['studio-video-tasks']

export const RUNNING_VIDEO = new Set<string>([
  TASK_STATUS.NOT_START,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.QUEUED,
  TASK_STATUS.IN_PROGRESS,
])

/** Image jobs, polled while any is still generating. */
export function useImageJobs() {
  return useQuery({
    queryKey: IMAGE_JOBS_KEY,
    queryFn: getImageJobs,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((job) => job.status === 'running')
        ? 3000
        : false,
  })
}

/** Video tasks, polled while any is still generating. */
export function useVideoTasks() {
  return useQuery({
    queryKey: VIDEO_TASKS_KEY,
    queryFn: getVideoTasks,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((task) => RUNNING_VIDEO.has(task.status))
        ? 5000
        : false,
  })
}

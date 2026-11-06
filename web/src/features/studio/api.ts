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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { getTaskArtifacts } from '@/features/usage-logs/api'
import type { TaskLog } from '@/features/usage-logs/types'

// Submissions can upload large reference images; the console relay endpoints
// bill the signed-in user, so no API key is involved.
const LONG_REQUEST_TIMEOUT_MS = 30 * 60 * 1000

export type StudioImageRequest = {
  group: string
  model: string
  prompt: string
  size?: string
  n: number
  references: File[]
}

/**
 * Starts a server-side image job and returns its ID. The job keeps running
 * when the page is closed; its images are stored on the server.
 */
export async function submitImages(request: StudioImageRequest): Promise<string> {
  const config = {
    params: { group: request.group, background: 1 },
    timeout: LONG_REQUEST_TIMEOUT_MS,
    skipErrorHandler: true,
  }
  let res
  if (request.references.length > 0) {
    const form = new FormData()
    form.append('model', request.model)
    form.append('prompt', request.prompt)
    form.append('n', String(request.n))
    if (request.size) form.append('size', request.size)
    for (const file of request.references) form.append('image[]', file)
    res = await api.post<{ id?: string }>('/pg/images/edits', form, config)
  } else {
    res = await api.post<{ id?: string }>(
      '/pg/images/generations',
      {
        model: request.model,
        prompt: request.prompt,
        n: request.n,
        size: request.size || undefined,
        response_format: 'b64_json',
      },
      config
    )
  }
  return res.data.id ?? ''
}

export type StudioImageJob = {
  id: string
  status: 'running' | 'success' | 'failed'
  prompt: string
  model: string
  group?: string
  size?: string
  /** Requested image count. */
  count?: number
  created_at: number
  finished_at?: number
  error?: string
  images: string[]
}

/** The signed-in user's studio image jobs, newest first. */
export async function getImageJobs(): Promise<StudioImageJob[]> {
  const res = await api.get('/api/studio/images')
  const data = requireServerSuccess(res.data) as { data?: StudioImageJob[] }
  return data.data ?? []
}

export async function deleteImageJob(id: string): Promise<void> {
  const res = await api.delete(`/api/studio/images/${encodeURIComponent(id)}`)
  requireServerSuccess(res.data)
}

export type StudioVideoRequest = {
  group: string
  model: string
  prompt: string
  size?: string
  seconds: number
  /** Reference images as data URLs. */
  images: string[]
}

export async function submitVideo(
  request: StudioVideoRequest
): Promise<string> {
  const res = await api.post<{ id?: string; task_id?: string }>(
    '/pg/videos',
    {
      model: request.model,
      prompt: request.prompt,
      size: request.size || undefined,
      seconds: String(request.seconds),
      images: request.images.length > 0 ? request.images : undefined,
    },
    {
      params: { group: request.group },
      timeout: LONG_REQUEST_TIMEOUT_MS,
      skipErrorHandler: true,
    }
  )
  return res.data.task_id || res.data.id || ''
}

/** The signed-in user's most recent video tasks shown in the studio. */
export async function getVideoTasks(): Promise<TaskLog[]> {
  const res = await api.get('/api/studio/videos')
  const data = requireServerSuccess(res.data) as { data?: TaskLog[] }
  return data.data ?? []
}

/** Removes a finished video from the studio and deletes its stored file. */
export async function deleteVideoTask(taskId: string): Promise<void> {
  const res = await api.delete(`/api/studio/videos/${encodeURIComponent(taskId)}`)
  requireServerSuccess(res.data)
}

/** Signed playback URL of a finished video task. */
export async function getVideoUrl(taskId: string): Promise<string | undefined> {
  const projection = await getTaskArtifacts(taskId)
  const video = projection.artifacts.find(
    (artifact) => artifact.type === 'video'
  )
  return video?.content_url ?? projection.legacyContentUrl
}

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

import type {
  PromptLogDetail,
  PromptLogFilters,
  PromptLogGlobalSetting,
  PromptLogItem,
  PromptLogSettingsResponse,
} from './types'

export interface GetPromptLogsResponse {
  success: boolean
  message: string
  data: {
    items: PromptLogItem[]
    total: number
    page: number
    page_size: number
  }
}

export async function getPromptLogs(
  filters: PromptLogFilters = {}
): Promise<GetPromptLogsResponse['data']> {
  const params = new URLSearchParams()
  if (filters.p) params.set('p', String(filters.p))
  if (filters.page_size) params.set('page_size', String(filters.page_size))
  if (filters.channel_id && filters.channel_id > 0) {
    params.set('channel_id', String(filters.channel_id))
  }
  if (filters.user_id && filters.user_id > 0) {
    params.set('user_id', String(filters.user_id))
  }
  if (filters.username?.trim()) {
    params.set('username', filters.username.trim())
  }
  if (filters.model_name?.trim()) {
    params.set('model_name', filters.model_name.trim())
  }
  if (filters.request_id?.trim()) {
    params.set('request_id', filters.request_id.trim())
  }
  if (filters.keyword?.trim()) {
    params.set('keyword', filters.keyword.trim())
  }
  if (typeof filters.has_attachments === 'boolean') {
    params.set('has_attachments', String(filters.has_attachments))
  }
  if (filters.start_timestamp && filters.start_timestamp > 0) {
    params.set('start_timestamp', String(filters.start_timestamp))
  }
  if (filters.end_timestamp && filters.end_timestamp > 0) {
    params.set('end_timestamp', String(filters.end_timestamp))
  }
  const query = params.toString()
  const res = await api.get<GetPromptLogsResponse>(
    query ? `/api/prompt_log/?${query}` : '/api/prompt_log/'
  )
  return requireServerSuccess(res.data).data
}

export async function getPromptLogDetail(id: number): Promise<PromptLogDetail> {
  const res = await api.get<{
    success: boolean
    message: string
    data: PromptLogDetail
  }>(`/api/prompt_log/${id}`)
  return requireServerSuccess(res.data).data
}

export async function fetchPromptAttachmentBlob(
  downloadUrl: string,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await api.get<Blob>(downloadUrl, {
    responseType: 'blob',
    signal,
  })
  return res.data
}

export async function downloadPromptAttachmentFile(
  downloadUrl: string,
  fileName: string
): Promise<void> {
  const sep = downloadUrl.includes('?') ? '&' : '?'
  const blob = await fetchPromptAttachmentBlob(`${downloadUrl}${sep}download=1`)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName || 'attachment'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}

export async function deletePromptLog(id: number): Promise<void> {
  const res = await api.delete<{ success: boolean; message: string }>(
    `/api/prompt_log/${id}`
  )
  requireServerSuccess(res.data)
}

export async function cleanupPromptLogs(params: {
  days?: number
  channel_id?: number
  all?: boolean
}): Promise<{ deleted: number }> {
  const res = await api.post<{
    success: boolean
    message: string
    data: { deleted: number }
  }>('/api/prompt_log/cleanup', params)
  return requireServerSuccess(res.data).data
}

export async function getPromptLogSettings(): Promise<PromptLogSettingsResponse> {
  const res = await api.get<{
    success: boolean
    message: string
    data: PromptLogSettingsResponse
  }>('/api/prompt_log/settings')
  return requireServerSuccess(res.data).data
}

export async function updatePromptLogSettings(
  payload: Partial<PromptLogGlobalSetting>
): Promise<PromptLogGlobalSetting> {
  const res = await api.put<{
    success: boolean
    message: string
    data: PromptLogGlobalSetting
  }>('/api/prompt_log/settings', payload)
  return requireServerSuccess(res.data).data
}

export async function toggleChannelPromptLog(
  channelId: number,
  enabled: boolean
): Promise<{ channel_id: number; prompt_log_enabled: boolean }> {
  const res = await api.put<{
    success: boolean
    message: string
    data: { channel_id: number; prompt_log_enabled: boolean }
  }>(`/api/prompt_log/channels/${channelId}`, { enabled })
  return requireServerSuccess(res.data).data
}

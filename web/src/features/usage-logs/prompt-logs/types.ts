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
export interface PromptLogAttachment {
  id: string
  kind: 'image' | 'audio' | 'video' | 'document' | 'file' | string
  source: string
  mime_type?: string
  file_name?: string
  field_name?: string
  size_bytes?: number
  sha256?: string
  external_url?: string
  truncated?: boolean
  error?: string
  has_file: boolean
  download_url?: string
}

export interface PromptLogItem {
  id: number
  created_at: number
  request_id: string
  channel_id: number
  channel_name: string
  channel_type: number
  user_id: number
  username: string
  token_id: number
  token_name: string
  model_name: string
  endpoint: string
  relay_format: string
  prompt_preview: string
  prompt_truncated: boolean
  message_count: number
  has_attachments: boolean
  attachment_count: number
  attachments: PromptLogAttachment[]
}

export interface PromptLogDetail extends PromptLogItem {
  prompt_text: string
  metadata_json?: string
}

export interface PromptLogChannelSummary {
  id: number
  name: string
  type: number
  status: number
  prompt_log_enabled: boolean
}

export interface PromptLogGlobalSetting {
  enabled: boolean
  retention_days: number
  max_text_bytes: number
  max_file_size_mb: number
}

export interface PromptLogSettingsResponse {
  global: PromptLogGlobalSetting
  channels: PromptLogChannelSummary[]
  can_manage_global: boolean
  can_manage_channels: boolean
}

export interface PromptLogFilters {
  p?: number
  page_size?: number
  channel_id?: number
  user_id?: number
  username?: string
  model_name?: string
  request_id?: string
  keyword?: string
  has_attachments?: boolean
  start_timestamp?: number
  end_timestamp?: number
}

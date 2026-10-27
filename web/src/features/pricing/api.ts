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

import type { PelicanRecord } from './lib/pelican'
import type { PricingData } from './types'

// ----------------------------------------------------------------------------
// Pricing APIs
// ----------------------------------------------------------------------------

// Get model pricing data
export async function getPricing(): Promise<PricingData> {
  const res = await api.get('/api/pricing')
  return res.data
}

// ----------------------------------------------------------------------------
// Pelican test records, shared with every viewer
// ----------------------------------------------------------------------------

type PelicanRecordDto = {
  id: number
  model: string
  vendor: string
  prompt: string
  group: string
  svg: string
  reasoning?: string
  reasoning_ms?: number | null
  created_at: number
  first_token_ms: number | null
  total_ms: number
  output_tokens: number | null
  username: string
  mine: boolean
}

function toPelicanRecord(dto: PelicanRecordDto): PelicanRecord {
  return {
    id: dto.id,
    model: dto.model,
    vendor: dto.vendor || undefined,
    prompt: dto.prompt,
    group: dto.group,
    svg: dto.svg,
    reasoning: dto.reasoning || undefined,
    reasoningMs: dto.reasoning_ms ?? undefined,
    createdAt: dto.created_at,
    firstTokenMs: dto.first_token_ms ?? undefined,
    totalMs: dto.total_ms,
    outputTokens: dto.output_tokens ?? undefined,
    username: dto.username,
    mine: dto.mine,
  }
}

export async function getPelicanRecords(): Promise<PelicanRecord[]> {
  const res = await api.get<{ data: PelicanRecordDto[] | null }>('/api/pelican')
  return (res.data.data ?? []).map(toPelicanRecord)
}

export type CreatePelicanRecordInput = Omit<
  PelicanRecord,
  'id' | 'createdAt' | 'username' | 'mine'
>

export async function createPelicanRecord(
  input: CreatePelicanRecordInput
): Promise<PelicanRecord> {
  const res = await api.post<{
    success: boolean
    message?: string
    data: PelicanRecordDto
  }>('/api/pelican', {
    model: input.model,
    vendor: input.vendor,
    prompt: input.prompt,
    group: input.group,
    svg: input.svg,
    reasoning: input.reasoning,
    reasoning_ms:
      input.reasoningMs === undefined
        ? undefined
        : Math.round(input.reasoningMs),
    first_token_ms: input.firstTokenMs,
    total_ms: Math.round(input.totalMs),
    output_tokens: input.outputTokens,
  })
  if (!res.data.success) throw new Error(res.data.message)
  return toPelicanRecord(res.data.data)
}

export async function deletePelicanRecord(id: number): Promise<void> {
  const res = await api.delete<{ success: boolean; message?: string }>(
    `/api/pelican/${id}`
  )
  if (!res.data.success) throw new Error(res.data.message)
}

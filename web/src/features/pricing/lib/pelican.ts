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

// ----------------------------------------------------------------------------
// Pelican test: ask a model to draw "a pelican riding a bicycle" as SVG
// ----------------------------------------------------------------------------

export const PELICAN_PROMPT = 'Generate an SVG of a pelican riding a bicycle'

const STORAGE_KEY = 'pricing-pelican-history'
// Pre-scoping key shared by every account on the browser; dropped on load.
const LEGACY_STORAGE_KEY = STORAGE_KEY
const HISTORY_LIMIT = 60

export type PelicanRecord = {
  id: string
  model: string
  vendor?: string
  prompt: string
  group: string
  svg: string
  createdAt: number
  firstTokenMs?: number
  totalMs: number
  outputTokens?: number
}

/** Extract the first complete `<svg>…</svg>` element from model output. */
export function extractSvg(text: string): string | null {
  const match = /<svg[\s\S]*?<\/svg>/i.exec(text)
  return match ? match[0] : null
}

/**
 * Data URL for rendering model SVG through `<img>`, which never runs scripts
 * or loads external resources embedded in untrusted markup.
 */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function isRecord(value: unknown): value is PelicanRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.model === 'string' &&
    typeof record.svg === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.totalMs === 'number'
  )
}

/** Records are private to each account, never shared across users. */
function storageKey(userId: number): string {
  return `${STORAGE_KEY}:${userId}`
}

export function loadPelicanHistory(userId?: number): PelicanRecord[] {
  if (userId === undefined) return []
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    const raw = window.localStorage.getItem(storageKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch {
    return []
  }
}

export function savePelicanHistory(
  records: PelicanRecord[],
  userId?: number
): PelicanRecord[] {
  const next = records.slice(0, HISTORY_LIMIT)
  if (userId === undefined) return next
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
  } catch {
    // Storage may be unavailable (private mode); keep the in-memory copy.
  }
  return next
}

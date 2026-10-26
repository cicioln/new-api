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

export const PELICAN_QUERY_KEY = ['pelican-records']

export const PELICAN_PROMPT = 'Generate an SVG of a pelican riding a bicycle'

export type PelicanRecord = {
  id: number
  model: string
  vendor?: string
  prompt: string
  group: string
  svg: string
  createdAt: number
  firstTokenMs?: number
  totalMs: number
  outputTokens?: number
  username: string
  mine: boolean
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

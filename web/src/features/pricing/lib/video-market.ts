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
import type { PricingModel } from '../types'

export const MARKET_MODALITIES = ['chat', 'video', 'image'] as const
export type MarketModality = (typeof MARKET_MODALITIES)[number]

const MODALITY_LABEL_KEYS: Record<MarketModality, string> = {
  chat: 'Chat',
  video: 'Video',
  image: 'Image',
}

export function getModalityLabelKey(modality: MarketModality): string {
  return MODALITY_LABEL_KEYS[modality]
}

const VIDEO_ENDPOINT_RE = /video/i
const IMAGE_ENDPOINT_RE = /image/i

export function isVideoModel(model: PricingModel): boolean {
  if (model.output_modalities?.includes('video')) return true
  const endpoints = model.supported_endpoint_types ?? []
  return endpoints.some((endpoint) => VIDEO_ENDPOINT_RE.test(endpoint))
}

export function isImageModel(model: PricingModel): boolean {
  if (isVideoModel(model)) return false
  if (model.output_modalities?.includes('image')) return true
  const endpoints = model.supported_endpoint_types ?? []
  return endpoints.some((endpoint) => IMAGE_ENDPOINT_RE.test(endpoint))
}

export function getModelModality(model: PricingModel): MarketModality {
  if (isVideoModel(model)) return 'video'
  if (isImageModel(model)) return 'image'
  return 'chat'
}

const DURATION_SUFFIX_RE = /(?:^|[-_\s])(\d{1,3})s$/i

/** Extract trailing duration in seconds from model IDs such as "muse-video-30s". */
export function parseVideoDurationSeconds(
  modelName: string
): number | undefined {
  const base = modelName.trim().split('/').pop() ?? ''
  const match = DURATION_SUFFIX_RE.exec(base)
  if (!match) return undefined
  const sec = Number.parseInt(match[1], 10)
  return Number.isFinite(sec) && sec > 0 ? sec : undefined
}

const WORD_OVERRIDES: Record<string, string> = {
  muse: 'Muse',
  veo: 'Veo',
  sora: 'Sora',
  kling: 'Kling',
  vidu: 'Vidu',
  seedance: 'Seedance',
  hailuo: 'Hailuo',
  wan: 'Wan',
  jimeng: 'Jimeng',
  pro: 'Pro',
  max: 'Max',
  hd: 'HD',
}

function formatVideoTitle(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase()
      return (
        WORD_OVERRIDES[lower] ??
        token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
      )
    })
    .join(' ')
}

export type VideoSeriesInfo = {
  /** Normalized series key shared across duration tiers, e.g. "muse-video". */
  key: string
  /** Display title, e.g. "Muse Video". */
  title: string
  /** Duration tier in seconds, e.g. 30. */
  durationSec: number
}

/**
 * Identifies duration-tiered video models that belong to a collapsible series
 * (e.g. "muse-video-10s" .. "muse-video-60s").
 */
export function getVideoSeriesInfo(
  model: PricingModel
): VideoSeriesInfo | null {
  if (!isVideoModel(model)) return null
  const base = model.model_name.trim().split('/').pop() ?? ''
  const match = /^(.*?)([-_\s])(\d{1,3})s$/i.exec(base)
  if (!match) return null
  const prefix = match[1].trim()
  const durationSec = Number.parseInt(match[3], 10)
  if (!prefix || !Number.isFinite(durationSec) || durationSec <= 0) return null
  return {
    key: prefix.toLowerCase(),
    title: formatVideoTitle(prefix),
    durationSec,
  }
}

/** Human-readable display title for a standalone video model ID. */
export function getVideoDisplayTitle(model: PricingModel): string {
  const series = getVideoSeriesInfo(model)
  if (series) return series.title
  const base = model.model_name.trim().split('/').pop() ?? model.model_name
  return formatVideoTitle(base)
}

export type VideoSpecMetadata = {
  /** Compact spec string such as "720p · 24fps". */
  specLine: string
  /** Whether native audio is supported based on model metadata. */
  hasAudio: boolean
  /** Capability label keys (passed to i18n `t()`). */
  capabilities: string[]
  /** Whether continuation / extension from a clip's last frame is supported. */
  supportsContinue: boolean
  /** Whether style/script presets are supported. */
  supportsPresets: boolean
}

/**
 * Extracts factual display metadata for a video model from its description,
 * tags and model name without fabricating unsupported specs.
 */
export function parseVideoMetadata(model: PricingModel): VideoSpecMetadata {
  const text = `${model.model_name} ${model.tags ?? ''} ${model.description ?? ''}`
  const lower = text.toLowerCase()

  const resolutionMatch = /\b(4k|2k|1080p|720p|480p)\b/i.exec(text)
  const resolution = resolutionMatch
    ? resolutionMatch[1].toLowerCase() === '4k' ||
      resolutionMatch[1].toLowerCase() === '2k'
      ? resolutionMatch[1].toUpperCase()
      : resolutionMatch[1].toLowerCase()
    : undefined

  let fps: string | undefined
  const fpsMatch = /\b(\d{2,3})\s*fps\b/i.exec(text)
  if (fpsMatch) {
    fps = `${fpsMatch[1]}fps`
  } else {
    const cnFpsMatch = /每秒\s*(\d{2,3})\s*帧/.exec(text)
    if (cnFpsMatch) {
      fps = `${cnFpsMatch[1]}fps`
    }
  }

  const hasAudio =
    /有声|原生音|音画同步|配音|native audio|with audio|\baudio\b/i.test(text) ||
    /muse-video/i.test(model.model_name)

  const supportsContinue =
    /续写|最后一帧|尾帧|reference_videos|extend|continue/i.test(text)
  const supportsPresets =
    /style_preset|skill_preset|custom_style|风格预设|脚本/i.test(text)

  const specParts: string[] = []
  if (resolution) specParts.push(resolution)
  if (fps) specParts.push(fps)
  const specLine = specParts.join(' · ')

  const capabilities: string[] = ['Text to Video', 'Image to Video']
  if (supportsContinue) capabilities.push('Frame Continuation')
  if (supportsPresets) capabilities.push('Style & Script Presets')

  // Recognize explicit aspect ratio hints when present.
  if (
    !supportsContinue &&
    !supportsPresets &&
    (lower.includes('16:9') || lower.includes('9:16'))
  ) {
    capabilities.push('16:9 / 9:16')
  }

  return {
    specLine,
    hasAudio,
    capabilities,
    supportsContinue,
    supportsPresets,
  }
}

/**
 * Formats latency / duration in exact seconds (e.g. "72s", "144s", "0.8s").
 * Returns "—" when no valid duration is available.
 */
export function formatExactSeconds(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 1000)}s`
}

/** Formats seconds into a compact MM:SS timecode, e.g. 30 -> "00:30", 60 -> "01:00". */
export function formatTimecode(sec: number): string {
  const safe = Math.max(0, Math.round(sec))
  const mins = Math.floor(safe / 60)
  const rem = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

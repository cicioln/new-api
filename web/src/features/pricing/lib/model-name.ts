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
import { getVendorAvatar } from './market'

export type ParsedModelName = {
  /** Lowercase family key, e.g. "sonnet", "glm". */
  family: string
  /** Display label, e.g. "Sonnet", "GLM". */
  label: string
  /** Display version, e.g. "4.5", "K2.5", "R1"; empty when none. */
  version: string
  /** Numeric part of the version for sorting. */
  versionNum: number
  /** Remaining suffixes, e.g. "Flash", "Thinking", "10/17". */
  tags: string[]
}

// Prefixes that name the vendor rather than the model family.
const DROPPED_PREFIXES = new Set(['claude', 'models'])

const FAMILY_LABELS: Record<string, string> = {
  gpt: 'GPT',
  glm: 'GLM',
  deepseek: 'DeepSeek',
  minimax: 'MiniMax',
  chatglm: 'ChatGLM',
  qwq: 'QwQ',
}

const FAMILY_COLORS: Record<string, string> = {
  opus: '#A855F7',
  sonnet: '#3B82F6',
  haiku: '#16A34A',
  gpt: '#10A37F',
  gemini: '#4285F4',
  glm: '#E8853D',
  kimi: '#EC4899',
  deepseek: '#4D6BFE',
  qwen: '#615CED',
  grok: '#64748B',
  llama: '#1877F2',
  mistral: '#FF7000',
  doubao: '#3B82F6',
  minimax: '#A855F7',
}

const VERSION_RE = /^([vkr]?)(\d+(?:\.\d+)?[a-z]?)$/
const DATE_RE = /^(\d{4}|\d{8})$/

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function formatTag(token: string): string {
  if (/^\d{8}$/.test(token)) {
    return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6)}`
  }
  if (/^\d{4}$/.test(token)) return `${token.slice(0, 2)}/${token.slice(2)}`
  if (/^\d+(\.\d+)?[bkm]$/.test(token)) return token.toUpperCase()
  return capitalize(token)
}

/**
 * Splits a model ID into family, version and suffix tags so cards can show
 * "Sonnet 4.5" instead of "claude-sonnet-4-5-20250929".
 */
export function parseModelName(id: string): ParsedModelName {
  const base = id.toLowerCase().split('/').pop() ?? ''
  const tokens = base.split(/[-_\s]+/).filter(Boolean)
  while (tokens.length > 1 && DROPPED_PREFIXES.has(tokens[0])) tokens.shift()

  let family = ''
  let version = ''
  let versionNum = 0
  const tags: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (DATE_RE.test(token) && (version || family)) {
      tags.push(formatTag(token))
      continue
    }
    const match = !version ? VERSION_RE.exec(token) : null
    if (match) {
      let digits = match[2]
      // "4-5" style versions: join a following single digit as the minor.
      if (/^\d+$/.test(digits) && /^\d$/.test(tokens[i + 1] ?? '')) {
        digits += `.${tokens[++i]}`
      }
      const prefix = match[1] === 'v' ? '' : match[1].toUpperCase()
      version = prefix + digits
      versionNum = parseFloat(digits) || 0
      continue
    }
    if (!family) {
      // "qwen3" → family "qwen", version "3"; keep short names like "o3".
      const glued = /^([a-z]{2,})(\d+(?:\.\d+)?)$/.exec(token)
      if (glued && !version) {
        family = glued[1]
        version = glued[2]
        versionNum = parseFloat(glued[2]) || 0
      } else {
        family = token
      }
      continue
    }
    tags.push(formatTag(token))
  }

  if (!family) family = base || id
  return {
    family,
    label: FAMILY_LABELS[family] ?? capitalize(family),
    version,
    versionNum,
    tags,
  }
}

/** Accent color for a model family, stable across renders. */
export function getFamilyColor(parsed: ParsedModelName): string {
  return FAMILY_COLORS[parsed.family] ?? getVendorAvatar(parsed.label).color
}

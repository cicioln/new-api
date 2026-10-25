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
import type { SystemInstance } from '../types'

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

function byteUnitIndex(bytes: number): number {
  if (bytes <= 0) return 0
  return Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1
  )
}

function formatInUnit(bytes: number, index: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(bytes / 1024 ** index)
}

export function formatBytes(bytes?: number, locale?: string): string {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '-'
  if (bytes < 0) return `-${formatBytes(-bytes, locale)}`
  const index = byteUnitIndex(bytes)
  return `${formatInUnit(bytes, index, locale)} ${BYTE_UNITS[index]}`
}

/**
 * Formats a used/total byte pair in the total's unit, e.g. "1.8" and "4 GB",
 * so the two numbers read as one fraction.
 */
export function formatBytePair(
  used: number,
  total: number,
  locale?: string
): { used: string; total: string } {
  const index = byteUnitIndex(total)
  return {
    used: formatInUnit(used, index, locale),
    total: `${formatInUnit(total, index, locale)} ${BYTE_UNITS[index]}`,
  }
}

export type UptimeParts = { days: number; hours: number; minutes: number }

/** Splits the time since a start timestamp (seconds) into display parts. */
export function getUptimeParts(
  startedAt: number | undefined,
  nowMs: number
): UptimeParts | null {
  if (!startedAt || startedAt <= 0) return null
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - startedAt)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  }
}

const DATABASE_LABEL: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
}

export function getDatabaseLabel(database?: string): string {
  if (!database) return '-'
  return DATABASE_LABEL[database] ?? database
}

/**
 * The instance the overview describes: the online master, then any online
 * instance, then whatever reported last.
 */
export function getPrimaryInstance(
  instances: SystemInstance[]
): SystemInstance | null {
  const online = instances.filter((instance) => instance.status === 'online')
  return (
    online.find((instance) => instance.info?.role?.is_master) ??
    online[0] ??
    instances[0] ??
    null
  )
}

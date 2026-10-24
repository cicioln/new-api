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
import { CHANNEL_STATUS, RESPONSE_TIME_THRESHOLDS } from '../constants'
import type { Channel } from '../types'

/** Columns aligned right in the design table. */
export const CHANNEL_NUMERIC_COLUMNS = new Set([
  'priority',
  'response_time',
  'balance',
])

export type ChannelDisplayStatus = {
  label: string
  className: string
}

/**
 * The status tag shown in the list. Enabled channels whose last test was slow
 * read as "Slow response", as in the design.
 */
export function getChannelDisplayStatus(
  channel: Channel
): ChannelDisplayStatus {
  if (channel.status === CHANNEL_STATUS.AUTO_DISABLED) {
    return {
      label: 'Auto Disabled',
      className: 'bg-destructive/10 text-destructive',
    }
  }
  if (channel.status !== CHANNEL_STATUS.ENABLED) {
    return {
      label: 'Manual Disabled',
      className: 'bg-muted text-muted-foreground',
    }
  }
  if (channel.response_time > RESPONSE_TIME_THRESHOLDS.GOOD) {
    return { label: 'Slow response', className: 'bg-warning/12 text-warning' }
  }
  return {
    label: 'Channel status enabled',
    className: 'bg-success/12 text-success',
  }
}

/** Status tab value → list API status filter and the counted status codes. */
export const CHANNEL_STATUS_TABS = [
  { value: 'all', label: 'All', statuses: null },
  {
    value: 'enabled',
    label: 'Channel status enabled',
    statuses: [CHANNEL_STATUS.ENABLED],
  },
  {
    value: 'auto',
    label: 'Auto Disabled',
    statuses: [CHANNEL_STATUS.AUTO_DISABLED],
  },
  {
    value: 'manual',
    label: 'Manual Disabled',
    statuses: [CHANNEL_STATUS.MANUAL_DISABLED],
  },
] as const

export type ChannelStatusTab = (typeof CHANNEL_STATUS_TABS)[number]['value']

export function getChannelStatusTab(status?: string[]): ChannelStatusTab {
  const value = status?.[0]
  const tab = CHANNEL_STATUS_TABS.find((item) => item.value === value)
  return tab?.value ?? 'all'
}

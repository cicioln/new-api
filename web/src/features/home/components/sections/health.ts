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
export type GroupHealth = 'ok' | 'degraded' | 'failing' | 'idle'

/** Maps a 1h success rate to the status color used on the home page. */
export function getGroupHealth(rate: number | null): GroupHealth {
  if (rate === null) return 'idle'
  if (rate >= 95) return 'ok'
  if (rate >= 80) return 'degraded'
  return 'failing'
}

export const GROUP_HEALTH_DOT: Record<GroupHealth, string> = {
  ok: 'bg-success text-success',
  degraded: 'bg-warning text-warning',
  failing: 'bg-destructive text-destructive',
  idle: 'bg-subtle-foreground/50 text-subtle-foreground/50',
}

export const GROUP_HEALTH_TEXT: Record<GroupHealth, string> = {
  ok: 'text-success',
  degraded: 'text-warning',
  failing: 'text-destructive',
  idle: 'text-subtle-foreground',
}

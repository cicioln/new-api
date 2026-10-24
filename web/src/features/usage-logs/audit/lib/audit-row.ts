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
import type { TFunction } from 'i18next'

import { sessionDevice } from '@/features/security/components/login-session-utils'

import type { AuditLog } from '../api'
import { buildAuditDetails } from './audit-details'

/**
 * The cells of one audit record as the design table and its CSV export show
 * them: the action, its object, and the client as "Browser · OS".
 */
export function auditRowText(entry: AuditLog, t: TFunction) {
  const detail = buildAuditDetails(entry, t)
  const userAgent = entry.user_agent ?? ''
  // Non-browser clients such as curl keep their product name.
  const name = userAgent.split(/[/\s]/)[0]
  const product = name && name !== 'Mozilla' ? name : t('Browser')
  const operation = detail.operation
  // Token and quota headlines and most rendered summaries already name
  // their target, so it only fills the object column when it would be new.
  const target =
    detail.target && !operation && !detail.summary.includes(detail.target)
      ? detail.target
      : ''
  return {
    action: operation ? operation.headline : detail.summary,
    identifier: operation?.identifier ?? '',
    object: operation?.description || target,
    client: sessionDevice(userAgent, '—', product),
  }
}

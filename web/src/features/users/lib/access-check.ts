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
import type { AccessCheckStep } from '../types'

type Translate = (key: string, params?: Record<string, unknown>) => string

export interface AccessCheckStepText {
  title: string
  detail: string
}

function text(detail: Record<string, unknown>, key: string): string {
  const value = detail[key]
  if (value == null) return ''
  return String(value)
}

function joinList(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(', ') : ''
}

/**
 * Describes one step of a user access check. The backend returns step keys
 * and the values each step looked at; the wording lives here so it follows
 * the console language.
 */
export function describeAccessCheckStep(
  step: AccessCheckStep,
  t: Translate
): AccessCheckStepText {
  const detail = step.detail ?? {}
  switch (step.key) {
    case 'user_status':
      return step.result === 'fail'
        ? { title: t('The user is disabled'), detail: '' }
        : { title: t('The user is enabled'), detail: '' }
    case 'token_status':
      return step.result === 'fail'
        ? {
            title: t('Token {{name}} is not enabled', {
              name: text(detail, 'token_name'),
            }),
            detail: '',
          }
        : {
            title: t('Token {{name}} can be used', {
              name: text(detail, 'token_name'),
            }),
            detail: '',
          }
    case 'token_expired':
      return {
        title: t('Token {{name}} has expired', {
          name: text(detail, 'token_name'),
        }),
        detail: '',
      }
    case 'token_quota':
      return {
        title: t('Token {{name}} has no quota left', {
          name: text(detail, 'token_name'),
        }),
        detail: '',
      }
    case 'group_forbidden':
      return {
        title: t('The user may not use group {{group}}', {
          group: text(detail, 'group'),
        }),
        detail: t('The gateway rejects the request with 403.'),
      }
    case 'group_deprecated':
      return {
        title: t('Group {{group}} no longer exists', {
          group: text(detail, 'group'),
        }),
        detail: t('The gateway rejects the request with 403.'),
      }
    case 'effective_group': {
      const group = text(detail, 'effective_group')
      if (detail.simulated) {
        return {
          title: t('Requests run under group {{group}}', { group }),
          detail: t('Simulated: the token group is set to {{group}}.', {
            group: text(detail, 'token_group') || text(detail, 'user_group'),
          }),
        }
      }
      return {
        title: t('Requests run under group {{group}}', { group }),
        detail: text(detail, 'token_group')
          ? t('Set on the token.')
          : t('The token sets no group, so it uses the user group.'),
      }
    }
    case 'model_limit':
      if (step.result === 'fail') {
        return {
          title: t('The token model limit does not include this model'),
          detail: joinList(detail.limits),
        }
      }
      return {
        title: detail.enabled
          ? t('The token model limit allows this model')
          : t('The token has no model limit'),
        detail: '',
      }
    case 'model_maintenance':
      return {
        title: t('The model is under maintenance'),
        detail: text(detail, 'maintenance_note'),
      }
    case 'channels':
      if (step.result === 'fail') {
        return {
          title: t('No enabled channel serves this model in {{groups}}', {
            groups: joinList(detail.groups),
          }),
          detail: t('The gateway rejects the request with 503.'),
        }
      }
      return {
        title: t('{{count}} enabled channels serve this model', {
          count: Number(detail.count ?? 0),
        }),
        detail: joinList(detail.matched_groups),
      }
    default:
      return { title: step.key, detail: '' }
  }
}

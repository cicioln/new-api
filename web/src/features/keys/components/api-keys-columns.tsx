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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import {
  API_KEY_EXPIRY_FILTER,
  API_KEY_LOW_QUOTA_RATIO,
  API_KEY_STATUS,
  API_KEY_STATUSES,
} from '../constants'
import type { ApiKey } from '../types'
import { ApiKeyQuotaCell } from './api-key-quota-cell'
import { ApiKeyTimestampCell } from './api-key-timestamp-cell'
import { ApiKeyCell } from './api-keys-cells'
import { DataTableRowActions } from './data-table-row-actions'

const STATUS_PILL_CLASSES: Record<string, string> = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

/** The status shown in the list: enabled keys close to their limit read as running low. */
export function getApiKeyDisplayStatus(apiKey: ApiKey, now: number) {
  if (
    apiKey.status === API_KEY_STATUS.ENABLED &&
    apiKey.expired_time !== -1 &&
    apiKey.expired_time * 1000 <= now
  ) {
    return { label: 'Expired', className: 'bg-destructive/10 text-destructive' }
  }
  const total = apiKey.used_quota + apiKey.remain_quota
  if (
    apiKey.status === API_KEY_STATUS.ENABLED &&
    !apiKey.unlimited_quota &&
    total > 0 &&
    apiKey.used_quota / total >= API_KEY_LOW_QUOTA_RATIO
  ) {
    return {
      label: 'Quota running low',
      className: 'bg-warning/12 text-warning',
    }
  }
  const config = API_KEY_STATUSES[apiKey.status]
  if (!config) return null
  return {
    label: config.label,
    className: STATUS_PILL_CLASSES[config.variant ?? 'neutral'],
  }
}

export function useApiKeysColumns(now: number): ColumnDef<ApiKey>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const justNowLabel = t('Just now')
  return useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('Name'),
        cell: ({ row }) => (
          <span className='font-medium!'>{row.getValue('name')}</span>
        ),
        meta: { mobileTitle: true },
      },
      {
        id: 'key',
        accessorKey: 'key',
        header: t('Key'),
        cell: ({ row }) => <ApiKeyCell apiKey={row.original} />,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const status = getApiKeyDisplayStatus(row.original, now)
          if (!status) return null
          return (
            <span
              className={cn(
                'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs! font-medium! whitespace-nowrap',
                status.className
              )}
            >
              <span
                className='size-1.5 rounded-full bg-current'
                aria-hidden='true'
              />
              {t(status.label)}
            </span>
          )
        },
        filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
        meta: { mobileBadge: true },
      },
      {
        accessorKey: 'group',
        header: t('Group'),
        cell: ({ row }) => {
          const group = (row.getValue('group') as string)?.trim() || ''
          return (
            <span className='bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 text-xs! font-medium! whitespace-nowrap'>
              {group || t('Follow user group')}
            </span>
          )
        },
        filterFn: (row, id, value) =>
          value.includes((row.getValue(id) as string)?.trim() || ''),
        meta: { mobileHidden: true },
      },
      {
        id: 'quota',
        accessorKey: 'remain_quota',
        header: t('Quota usage'),
        cell: ({ row }) => <ApiKeyQuotaCell apiKey={row.original} now={now} />,
      },
      {
        id: 'model_limits',
        accessorKey: 'model_limits',
        header: t('Available models'),
        cell: ({ row }) => {
          const models = row.original.model_limits_enabled
            ? (row.original.model_limits || '').split(',').filter(Boolean)
            : []
          return (
            <span className='text-muted-foreground block max-w-60 truncate font-mono! text-xs!'>
              {models.length ? models.join(', ') : t('All')}
            </span>
          )
        },
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'expired_time',
        header: t('Expiration Time'),
        cell: ({ row }) => {
          const expiredTime = row.getValue('expired_time') as number
          if (expiredTime === -1) {
            return (
              <span className='text-subtle-foreground'>
                {t('Never expires')}
              </span>
            )
          }
          return (
            <time
              dateTime={new Date(expiredTime * 1000).toISOString()}
              className='text-subtle-foreground tabular-nums'
            >
              {dayjs(expiredTime * 1000).format('YYYY-MM-DD')}
            </time>
          )
        },
        filterFn: (row, id, value: string[]) => {
          const expiredTime = row.getValue(id) as number
          if (expiredTime === -1) {
            return value.includes(API_KEY_EXPIRY_FILTER.NEVER)
          }
          if (expiredTime * 1000 <= now) {
            return value.includes(API_KEY_EXPIRY_FILTER.EXPIRED)
          }
          return value.includes(API_KEY_EXPIRY_FILTER.SCHEDULED)
        },
        meta: { mobileHidden: true },
      },
      {
        id: 'accessed_time',
        accessorKey: 'accessed_time',
        header: t('Last Used'),
        cell: ({ row }) => (
          <ApiKeyTimestampCell
            timestamp={row.original.accessed_time}
            now={now}
            locale={locale}
            justNowLabel={justNowLabel}
            className='text-subtle-foreground'
          />
        ),
        meta: { mobileHidden: true },
      },
      {
        id: 'actions',
        header: () => <span className='sr-only'>{t('Actions')}</span>,
        cell: ({ row }) => <DataTableRowActions row={row} />,
        meta: { pinned: 'right' as const },
      },
    ],
    [t, now, locale, justNowLabel]
  )
}

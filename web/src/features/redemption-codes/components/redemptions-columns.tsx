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

import dayjs from '@/lib/dayjs'
import { formatQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { REDEMPTION_FILTER_EXPIRED } from '../constants'
import { isRedemptionExpired } from '../lib'
import type { Redemption } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { RedemptionCodeCell } from './redemption-code-cell'
import { RedemptionStatusTag } from './redemption-status-tag'

export function useRedemptionsColumns(): ColumnDef<Redemption>[] {
  const { t } = useTranslation()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  return useMemo<ColumnDef<Redemption>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('ID'),
        enableSorting: false,
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono! text-[12.5px]!'>
            {row.original.id}
          </span>
        ),
        size: 64,
      },
      {
        accessorKey: 'name',
        header: t('Name'),
        enableSorting: false,
        meta: { mobileTitle: true },
        cell: ({ row }) => (
          <span className='whitespace-nowrap'>{row.original.name}</span>
        ),
      },
      {
        id: 'code',
        accessorKey: 'key',
        header: t('Redemption Code'),
        enableSorting: false,
        cell: ({ row }) => <RedemptionCodeCell code={row.original.key} />,
      },
      {
        accessorKey: 'quota',
        header: t('Quota'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='font-mono! text-[12.5px]! tabular-nums'>
            {formatQuota(row.original.quota)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        enableSorting: false,
        meta: { mobileBadge: true },
        cell: ({ row }) => <RedemptionStatusTag redemption={row.original} />,
        filterFn: (row, id, value) => {
          const redemption = row.original
          const statusValue = row.getValue(id) as number
          if (
            value.includes(REDEMPTION_FILTER_EXPIRED) &&
            isRedemptionExpired(redemption.expired_time, statusValue)
          ) {
            return true
          }
          return value.includes(String(statusValue))
        },
      },
      {
        accessorKey: 'used_user_id',
        header: t('Redeemed By'),
        enableSorting: false,
        cell: ({ row }) => {
          const redemption = row.original
          if (redemption.used_user_id === 0) return '—'
          return (
            <span className='whitespace-nowrap'>
              {redemption.used_username ||
                t('User {{id}}', { id: redemption.used_user_id })}
            </span>
          )
        },
      },
      {
        accessorKey: 'expired_time',
        header: t('Expiration Time'),
        enableSorting: false,
        cell: ({ row }) => {
          const expiredTime = row.original.expired_time
          return (
            <span className='text-muted-foreground whitespace-nowrap'>
              {expiredTime === 0
                ? t('Never expires')
                : dayjs(expiredTime * 1000).format('YYYY-MM-DD')}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className='sr-only'>{t('Actions')}</span>,
        enableSorting: false,
        enableHiding: false,
        size: 44,
        cell: ({ row }) => (
          <div className='-my-1.5'>
            <DataTableRowActions row={row} />
          </div>
        ),
      },
    ],
    // Quota formatting reads the currency configuration from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, currencyConfig]
  )
}

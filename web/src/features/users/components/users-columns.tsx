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

import { DataTableColumnHeader } from '@/components/data-table/core/column-header'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { USER_ROLE, USER_STATUS, isUserDeleted } from '../constants'
import type { User } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { UserQuotaCell } from './user-quota-cell'

const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[12px]! font-medium whitespace-nowrap'
const numericCellClass = 'font-mono! text-[12.5px]! tabular-nums'
const timeCellClass = 'font-mono! text-[12px]! tabular-nums whitespace-nowrap'

function getRoleLabelKey(role: number) {
  if (role >= USER_ROLE.ROOT) return 'Super Admin'
  if (role >= USER_ROLE.ADMIN) return 'Admin'
  return 'Regular user'
}

export function useUsersColumns(): ColumnDef<User>[] {
  const { t, i18n } = useTranslation()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'id',
        header: t('ID'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono! text-[12.5px]!'>
            {row.original.id}
          </span>
        ),
        size: 64,
        meta: { mobileOrder: 10 },
      },
      {
        accessorKey: 'username',
        header: t('User'),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original
          return (
            <span className='whitespace-nowrap'>
              <b className='font-medium!'>
                {user.display_name || user.username}
              </b>{' '}
              <span className='text-muted-foreground'>{user.username}</span>
            </span>
          )
        },
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'group',
        header: t('Group'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={cn(tagClass, 'bg-muted text-muted-foreground')}>
            {row.original.group || 'default'}
          </span>
        ),
        meta: { mobileOrder: 30 },
      },
      {
        accessorKey: 'role',
        header: t('Role'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='whitespace-nowrap'>
            {t(getRoleLabelKey(row.original.role))}
          </span>
        ),
        meta: { mobileOrder: 20 },
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original
          const active =
            !isUserDeleted(user) && user.status === USER_STATUS.ENABLED
          return (
            <span
              className={cn(
                tagClass,
                active
                  ? 'bg-success/12 text-success'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {active && (
                <span
                  className='size-1.5 rounded-full bg-current'
                  aria-hidden='true'
                />
              )}
              {t(active ? 'Normal' : 'Banned')}
            </span>
          )
        },
        meta: { mobileBadge: true },
      },
      {
        id: 'quota',
        accessorKey: 'quota',
        header: t('Quota usage'),
        enableSorting: false,
        cell: ({ row }) => (
          <UserQuotaCell
            remaining={row.original.quota}
            used={row.original.used_quota}
          />
        ),
        meta: { mobileOrder: 40 },
      },
      {
        accessorKey: 'request_count',
        header: t('Requests'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={numericCellClass}>
            {formatNumber(row.original.request_count, locale)}
          </span>
        ),
      },
      {
        accessorKey: 'aff_count',
        header: t('Invites'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={numericCellClass}>
            {formatNumber(row.original.aff_count || 0, locale)}
          </span>
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('Registration time')}
          />
        ),
        cell: ({ row }) => (
          <span className={cn(timeCellClass, 'text-muted-foreground')}>
            {formatTimestampToDate(row.original.created_at)}
          </span>
        ),
        meta: { mobileOrder: 50 },
      },
      {
        accessorKey: 'last_login_at',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Last Login')} />
        ),
        cell: ({ row }) => (
          <span className={cn(timeCellClass, 'text-muted-foreground')}>
            {formatTimestampToDate(row.original.last_login_at)}
          </span>
        ),
        meta: { mobileOrder: 60 },
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
    // The quota cell reads the currency configuration from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, currencyConfig]
  )
}

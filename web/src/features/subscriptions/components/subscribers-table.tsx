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
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getAllUserSubscriptions } from '../api'
import type { AdminUserSubscription } from '../types'
import { useSubscriptions } from './subscriptions-provider'

const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[12px]! font-medium! whitespace-nowrap'

function formatDate(seconds: number) {
  return seconds ? dayjs(seconds * 1000).format('YYYY-MM-DD') : '—'
}

function getUsedPercent(used: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

function getStatus(subscription: AdminUserSubscription, now: number) {
  if (subscription.status === 'cancelled') {
    return { label: 'Cancelled', className: 'bg-muted text-muted-foreground' }
  }
  if (subscription.status !== 'active' || subscription.end_time <= now) {
    return { label: 'Expired', className: 'bg-muted text-muted-foreground' }
  }
  return { label: 'Active', className: 'bg-success/12 text-success' }
}

function QuotaUsage(props: { used: number; total: number }) {
  const { t } = useTranslation()
  if (props.total <= 0) {
    return <span className='text-muted-foreground'>{t('Unlimited')}</span>
  }
  const percent = getUsedPercent(props.used, props.total)
  return (
    <span className='flex min-w-[120px] items-center gap-2'>
      <span
        role='progressbar'
        aria-label={t('Used percentage')}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className='bg-muted h-1 flex-1 overflow-hidden rounded-full'
      >
        <span
          className='bg-primary block h-full rounded-full'
          style={{ width: `${percent}%` }}
        />
      </span>
      <small className='text-subtle-foreground font-mono! text-[11.5px]! tabular-nums'>
        {percent}%
      </small>
    </span>
  )
}

function useSubscriberColumns(): ColumnDef<AdminUserSubscription>[] {
  const { t } = useTranslation()
  return useMemo<ColumnDef<AdminUserSubscription>[]>(() => {
    const now = Math.floor(Date.now() / 1000)
    return [
      {
        accessorKey: 'username',
        header: t('User'),
        enableSorting: false,
        meta: { mobileTitle: true },
        cell: ({ row }) =>
          row.original.username ||
          t('User {{id}}', { id: row.original.user_id }),
      },
      {
        accessorKey: 'plan_title',
        header: t('Plan'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={cn(tagClass, 'bg-muted text-muted-foreground')}>
            {row.original.plan_title || `#${row.original.plan_id}`}
          </span>
        ),
      },
      {
        accessorKey: 'start_time',
        header: t('Start'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDate(row.original.start_time)}
          </span>
        ),
      },
      {
        accessorKey: 'end_time',
        header: t('Expires'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDate(row.original.end_time)}
          </span>
        ),
      },
      {
        id: 'quota',
        header: t('Current quota'),
        enableSorting: false,
        cell: ({ row }) => (
          <QuotaUsage
            used={Number(row.original.amount_used || 0)}
            total={Number(row.original.amount_total || 0)}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        enableSorting: false,
        meta: { mobileBadge: true },
        cell: ({ row }) => {
          const status = getStatus(row.original, now)
          return (
            <span className={cn(tagClass, status.className)}>
              <span
                className='size-1.5 rounded-full bg-current'
                aria-hidden='true'
              />
              {t(status.label)}
            </span>
          )
        },
      },
    ]
  }, [t])
}

export function SubscribersTable() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { refreshTrigger } = useSubscriptions()
  const columns = useSubscriberColumns()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-user-subscriptions',
      pagination.pageIndex,
      pagination.pageSize,
      refreshTrigger,
    ],
    queryFn: async () => {
      const result = requireServerSuccess(
        await getAllUserSubscriptions({
          p: pagination.pageIndex + 1,
          page_size: pagination.pageSize,
        })
      )
      return result.data ?? { items: [], total: 0 }
    },
    placeholderData: (prev) => prev,
  })

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    getRowId: (row) => String(row.id),
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    withFilteredRowModel: false,
    withFacetedRowModel: false,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No subscribers yet')}
      emptyDescription={t('Users who subscribe to a plan will appear here.')}
      skeletonKeyPrefix='subscribers-skeleton'
      fixedHeight={false}
      simplePagination
      paginationTotalLabel={(total) =>
        t('{{count}} subscriptions total', {
          count: formatNumber(total, locale),
        })
      }
      toolbar={
        <h3 className='text-[14px] font-semibold'>{t('Subscribers')}</h3>
      }
    />
  )
}

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
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getChannels, getGroups, searchChannels } from '../api'
import { DEFAULT_PAGE_SIZE } from '../constants'
import {
  CHANNEL_NUMERIC_COLUMNS,
  channelsQueryKeys,
  getChannelStatusTab,
  getChannelTypeLabel,
} from '../lib'
import type { Channel } from '../types'
import { ChannelStatusTabs } from './channel-status-tabs'
import { useChannelsColumns } from './channels-columns'
import { DataTableBulkActions } from './data-table-bulk-actions'

const route = getRouteApi('/_authenticated/channels/')

function firstFilterValue(values: unknown): string | undefined {
  return Array.isArray(values) && values.length > 0
    ? String(values[0])
    : undefined
}

export function ChannelsTable() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const search = route.useSearch()
  const statusTab = getChannelStatusTab(search.status)

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate: route.useNavigate(),
    pagination: {
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : DEFAULT_PAGE_SIZE,
    },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'type', searchKey: 'type', type: 'array' },
      { columnId: 'group', searchKey: 'group', type: 'array' },
      { columnId: 'tag', searchKey: 'tag', type: 'array' },
    ],
  })

  const filterOf = (id: string) =>
    firstFilterValue(columnFilters.find((filter) => filter.id === id)?.value)
  const typeFilter = filterOf('type')
  const listParams = {
    group: filterOf('group'),
    status: statusTab === 'all' ? undefined : statusTab,
    type: typeFilter === undefined ? undefined : Number(typeFilter),
    tag: filterOf('tag'),
    p: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  }
  // One box searches names, IDs and models; the list API serves the rest.
  const keyword = globalFilter?.trim() ?? ''

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: channelsQueryKeys.list({ ...listParams, keyword }),
    queryFn: async () =>
      keyword
        ? requireServerSuccess(await searchChannels({ ...listParams, keyword }))
        : requireServerSuccess(await getChannels(listParams)),
    placeholderData: (previousData) => previousData,
  })

  const channels = useMemo(() => data?.data?.items ?? [], [data])
  const columns = useChannelsColumns()

  const { table } = useDataTable({
    data: channels,
    columns,
    totalCount: data?.data?.total ?? 0,
    initialColumnVisibility: { tag: false },
    columnVisibilityStorageKey: false,
    enableSorting: false,
    columnFilters,
    pagination,
    globalFilter,
    globalFilterFn: () => true,
    enableRowSelection: true,
    onColumnFiltersChange,
    onPaginationChange,
    onGlobalFilterChange,
    getRowId: (row: Channel) => String(row.id),
    manualPagination: true,
    manualFiltering: true,
    ensurePageInRange,
  })

  const typeCounts = data?.data?.type_counts
  const typeOptions = useMemo(
    () =>
      Object.entries(typeCounts ?? {})
        .filter(([type, count]) => Number(type) > 0 && count > 0)
        .map(([type, count]) => ({
          label: getChannelTypeLabel(Number(type)),
          value: type,
          count,
        }))
        .sort((a, b) => t(a.label).localeCompare(t(b.label))),
    [t, typeCounts]
  )
  const groupOptions = useMemo(
    () => (groupsData?.data ?? []).map((g) => ({ label: g, value: g })),
    [groupsData]
  )
  const tags = data?.data?.tags
  const tagOptions = useMemo(
    () => (tags ?? []).map((tag) => ({ label: tag, value: tag })),
    [tags]
  )

  return (
    <div className='flex h-full min-h-0 flex-col gap-[18px]'>
      <ChannelStatusTabs counts={data?.data?.status_counts} />
      <div className='min-h-0 flex-1'>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyTitle={t('No Channels Found')}
          emptyDescription={t(
            'No channels available. Create your first channel to get started.'
          )}
          skeletonKeyPrefix='channel-skeleton'
          simplePagination
          paginationTotalLabel={(total) =>
            t('{{count}} channels total', { count: total })
          }
          toolbarProps={{
            searchPlaceholder: t('Name, ID or model'),
            searchDebounceMs: 500,
            hideViewOptions: true,
            filters: [
              {
                columnId: 'type',
                title: t('Type'),
                options: typeOptions,
                singleSelect: true,
              },
              {
                columnId: 'group',
                title: t('Groups'),
                options: groupOptions,
                singleSelect: true,
              },
              {
                columnId: 'tag',
                title: t('Tag'),
                options: tagOptions,
                singleSelect: true,
              },
            ],
          }}
          beforeTable={<DataTableBulkActions table={table} />}
          getColumnClassName={(columnId) =>
            CHANNEL_NUMERIC_COLUMNS.has(columnId) ? 'text-right' : undefined
          }
        />
      </div>
    </div>
  )
}

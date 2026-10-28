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
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  DataTableRow,
  useDataTable,
} from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getAuditLogs, type AuditFilters, type AuditLog } from '../api'
import { useAuditLogColumns } from './audit-log-columns'
import { AuditLogDetailsDialog } from './audit-log-details-dialog'
import { AuditLogFilterBar } from './audit-log-filter-bar'

const EMPTY_LOGS: AuditLog[] = []

export function AuditLogViewer(props: {
  scope: 'all' | 'self'
  accessOnly?: boolean
  currentTokenRef?: string
  // The token scope the viewer opens with and returns to on reset.
  defaultTokenScope?: 'all' | 'current'
  onAccessDenied?: () => Promise<void>
  // Reports the applied query so the page header can export the same records.
  onParamsChange?: (params: AuditFilters | undefined) => void
}) {
  const { t, i18n } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [detail, setDetail] = useState<AuditLog | null>(null)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [filters, setFilters] = useState<AuditFilters>({ p: 1, page_size: 20 })
  const defaultTokenScope = props.defaultTokenScope ?? 'all'
  const [tokenScope, setTokenScope] = useState<string>(defaultTokenScope)
  const params = { ...filters }
  if (props.accessOnly) params.category = 'access_token'
  if (tokenScope === 'current') params.token_ref = props.currentTokenRef
  if (tokenScope === 'historical') {
    params.exclude_token_ref = props.currentTokenRef
  }
  const canQuery =
    tokenScope === 'all' ||
    (props.currentTokenRef !== undefined &&
      (tokenScope === 'historical' || !!props.currentTokenRef))
  const invalidRange =
    filters.start_timestamp !== undefined &&
    filters.end_timestamp !== undefined &&
    filters.start_timestamp > filters.end_timestamp
  const query = useQuery({
    queryKey: ['audit', userId, props.scope, params],
    queryFn: async () =>
      requireServerSuccess(await getAuditLogs(props.scope, params)),
    enabled: canQuery && !invalidRange,
    retry: false,
  })
  const accessDenied =
    props.scope === 'all' &&
    isAxiosError(query.error) &&
    query.error.response?.status === 403
  const onAccessDenied = props.onAccessDenied
  useEffect(() => {
    if (accessDenied) void onAccessDenied?.()
  }, [accessDenied, onAccessDenied])
  const onParamsChange = props.onParamsChange
  const queryable = canQuery && !invalidRange
  const paramsKey = JSON.stringify(params)
  useEffect(() => {
    onParamsChange?.(queryable ? JSON.parse(paramsKey) : undefined)
  }, [onParamsChange, paramsKey, queryable])
  // Records of a revoked scope must not stay open in the details dialog.
  if (detail && (accessDenied || query.isError)) setDetail(null)
  const designTable = !props.accessOnly
  const columns = useAuditLogColumns(props.accessOnly)
  const { table } = useDataTable({
    columns,
    data:
      canQuery && !query.isError
        ? (query.data?.items ?? EMPTY_LOGS)
        : EMPTY_LOGS,
    getRowId: (entry) => entry.event_id,
    columnVisibility: designTable ? { details: isMobile } : undefined,
    totalCount: query.isError ? 0 : (query.data?.total ?? 0),
    pagination: { pageIndex: filters.p - 1, pageSize: filters.page_size },
    onPaginationChange: (updater) => {
      if (query.isFetching || query.isError || invalidRange || !canQuery) return
      setFilters((previous) => {
        const current = {
          pageIndex: previous.p - 1,
          pageSize: previous.page_size,
        }
        const next = typeof updater === 'function' ? updater(current) : updater
        return {
          ...previous,
          p: next.pageSize === previous.page_size ? next.pageIndex + 1 : 1,
          page_size: next.pageSize,
        }
      })
    },
    // The "+ Action type" chip filters the action column by category.
    columnFilters: filters.category
      ? [{ id: 'action', value: [filters.category] }]
      : [],
    onColumnFiltersChange: (updater) => {
      const current = filters.category
        ? [{ id: 'action', value: [filters.category] }]
        : []
      const next = typeof updater === 'function' ? updater(current) : updater
      const value = next.find((filter) => filter.id === 'action')?.value
      update({
        category: Array.isArray(value) ? String(value[0]) : undefined,
      })
    },
    enableRowSelection: false,
    enableSorting: false,
    manualFiltering: true,
    manualPagination: true,
  })
  const update = (patch: Partial<AuditFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch, p: 1 }))

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={query.isPending && canQuery && !invalidRange}
        isFetching={query.isFetching}
        emptyTitle={
          query.isError ? t('Failed to load audit records') : t('No records')
        }
        hideMobile={props.accessOnly}
        paginationInFooter={!props.accessOnly}
        className='h-auto min-h-0 flex-1'
        compactPagination={designTable && isMobile}
        simplePagination={designTable && !isMobile}
        paginationTotalLabel={
          designTable
            ? (total) =>
                t('{{total}} records total', {
                  total: formatNumber(
                    total,
                    toIntlLocale(i18n.resolvedLanguage || i18n.language)
                  ),
                })
            : undefined
        }
        autoColumnWidths={designTable}
        applyHeaderSize={!designTable}
        getColumnClassName={designTable ? undefined : () => 'py-2'}
        tableClassName={
          designTable
            ? undefined
            : '[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
        }
        mobileProps={
          designTable ? { getRowClassName: () => 'cursor-pointer' } : undefined
        }
        renderRow={
          designTable
            ? (row) => (
                <DataTableRow
                  key={row.id}
                  row={row}
                  className='cursor-pointer transition-colors'
                  cellRenderColumns={table.options.columns}
                  onClick={() => setDetail(row.original)}
                />
              )
            : undefined
        }
        toolbar={
          <div className='shrink-0 space-y-2'>
            <AuditLogFilterBar
              table={table}
              filters={filters}
              onChange={update}
              scope={props.scope}
              accessOnly={props.accessOnly}
              tokenScope={tokenScope}
              defaultTokenScope={defaultTokenScope}
              currentTokenRef={props.currentTokenRef}
              onTokenScopeChange={(value) => {
                setTokenScope(value)
                update({})
              }}
              isFetching={query.isFetching}
              onSearch={() => {
                if (!invalidRange && canQuery) void query.refetch()
              }}
              onReset={() => {
                setTokenScope(defaultTokenScope)
                setFilters({ p: 1, page_size: filters.page_size })
              }}
            />
            {invalidRange && (
              <Alert variant='destructive'>
                <AlertDescription>
                  {t('End time must be after start time')}
                </AlertDescription>
              </Alert>
            )}
            {query.isError && (
              <Alert variant='destructive'>
                <AlertDescription className='flex items-center justify-between gap-2'>
                  <span>{t('Failed to load audit records')}</span>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => void query.refetch()}
                  >
                    {t('Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        }
      />
      {detail && (
        <AuditLogDetailsDialog
          entry={detail}
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null)
          }}
        />
      )}
    </div>
  )
}

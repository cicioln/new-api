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
import { ErrorState } from '@/components/error-state'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  getServerMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getModels, getVendors } from '../api'
import { DEFAULT_PAGE_SIZE, MODEL_NUMERIC_COLUMNS } from '../constants'
import { modelsQueryKeys, vendorsQueryKeys } from '../lib'
import { useModelsColumns } from './models-columns'

const route = getRouteApi('/_authenticated/models/$section')

export function ModelsTable() {
  const { t } = useTranslation()
  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search: route.useSearch(),
      navigate: route.useNavigate(),
      pagination: { defaultPage: 1, defaultPageSize: DEFAULT_PAGE_SIZE },
      globalFilter: { enabled: false },
    })

  const { data: vendorsData } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: async () =>
      requireServerSuccess(await getVendors({ page_size: 1000 })),
  })
  const vendors = useMemo(
    () => vendorsData?.data?.items || [],
    [vendorsData?.data?.items]
  )

  const params = {
    include_channel_models: true,
    p: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  }
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: modelsQueryKeys.list(params),
    queryFn: async () => requireServerSuccess(await getModels(params)),
  })

  const models = data?.data?.items || []
  const totalCount = data?.data?.total || 0
  const columns = useModelsColumns(vendors)

  const { table } = useDataTable({
    data: models,
    getRowId: (model) =>
      model.id > 0 ? `metadata:${model.id}` : `channel:${model.model_name}`,
    columns,
    totalCount,
    pagination,
    onPaginationChange,
    manualPagination: true,
    manualFiltering: true,
    ensurePageInRange,
  })

  if (isError || data?.success === false) {
    return (
      <ErrorState
        description={error?.message ?? getServerMessage(data)}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Models Found')}
      emptyDescription={t(
        'No models available. Create your first model to get started.'
      )}
      skeletonKeyPrefix='model-skeleton'
      applyHeaderSize
      fixedHeight={false}
      toolbarProps={null}
      showPagination={totalCount > pagination.pageSize}
      simplePagination
      paginationTotalLabel={(total) =>
        t('{{count}} models total', { count: total })
      }
      getColumnClassName={(columnId) =>
        MODEL_NUMERIC_COLUMNS.has(columnId) ? 'text-right' : undefined
      }
    />
  )
}

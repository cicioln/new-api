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
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import {
  getModelEndpointPaths,
  handleToggleModelStatus,
  parseModelTags,
} from '../lib'
import type { Model, Vendor } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { useModels } from './models-provider'

const EMPTY_VENDORS: Vendor[] = []

export function useModelsColumns(
  vendors: Vendor[] = EMPTY_VENDORS
): ColumnDef<Model>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const { setCurrentRow, setOpen } = useModels()
  const vendorMap = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor])),
    [vendors]
  )
  return useMemo<ColumnDef<Model>[]>(
    () => [
      {
        accessorKey: 'model_name',
        header: t('Model'),
        size: 220,
        enableHiding: false,
        meta: { mobileTitle: true },
        cell: ({ row }) => (
          <Button
            variant='link'
            className='text-foreground h-auto max-w-full min-w-0 justify-start p-0 font-mono! text-[12.5px]! font-normal hover:no-underline'
            title={row.original.model_name}
            onClick={() => {
              setCurrentRow(row.original)
              setOpen('update-model')
            }}
          >
            <span className='truncate'>{row.original.model_name}</span>
          </Button>
        ),
      },
      {
        accessorKey: 'vendor_id',
        header: t('Vendor'),
        size: 130,
        enableSorting: false,
        cell: ({ row }) => (
          <span className='block truncate'>
            {vendorMap.get(row.original.vendor_id ?? 0)?.name ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'tags',
        header: t('Tags'),
        size: 200,
        enableSorting: false,
        cell: ({ row }) => {
          const tags = parseModelTags(row.original.tags)
          if (!tags.length) return '—'
          return (
            <div className='flex min-w-0 flex-wrap gap-1'>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className='bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 text-[12px]! font-medium whitespace-nowrap'
                >
                  {tag}
                </span>
              ))}
            </div>
          )
        },
      },
      {
        id: 'endpoints',
        header: t('Endpoints'),
        size: 240,
        enableSorting: false,
        cell: ({ row }) => {
          const paths = getModelEndpointPaths(row.original)
          if (!paths.length) return '—'
          return (
            <span
              className='text-subtle-foreground block truncate font-mono! text-[11.5px]!'
              title={paths.join('\n')}
            >
              {paths[0]}
              {paths.length > 1 && ` +${paths.length - 1}`}
            </span>
          )
        },
      },
      {
        id: 'channel_count',
        header: t('Channel count'),
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <span className='font-mono! text-[12.5px]! tabular-nums'>
            {formatNumber(
              row.original.configured_channel_count ??
                row.original.bound_channels?.length ??
                0,
              locale
            )}
          </span>
        ),
      },
      {
        id: 'billing',
        header: t('Billing'),
        size: 90,
        enableSorting: false,
        cell: ({ row }) => {
          const types = row.original.quota_types ?? []
          if (!types.length) return '—'
          return types
            .map((type) =>
              type === 1 ? t('Billing per call') : t('Billing metered')
            )
            .join(' / ')
        },
      },
      {
        accessorKey: 'status',
        header: t('Listed'),
        size: 80,
        enableSorting: false,
        meta: { mobileBadge: true },
        cell: ({ row }) => (
          <Switch
            checked={row.original.status === 1}
            disabled={row.original.id <= 0}
            aria-label={t('List {{name}} in model square', {
              name: row.original.model_name,
            })}
            onCheckedChange={() =>
              handleToggleModelStatus(
                row.original.id,
                row.original.status,
                queryClient
              )
            }
            className='data-checked:bg-success data-unchecked:bg-border px-px data-[size=default]:h-5 data-[size=default]:w-[34px]'
          />
        ),
      },
      {
        id: 'actions',
        header: () => <span className='sr-only'>{t('Actions')}</span>,
        enableSorting: false,
        enableHiding: false,
        size: 44,
        cell: ({ row }) => (
          <div className='-my-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-aria-expanded:opacity-100'>
            <DataTableRowActions row={row} />
          </div>
        ),
      },
    ],
    [t, locale, vendorMap, queryClient, setCurrentRow, setOpen]
  )
}

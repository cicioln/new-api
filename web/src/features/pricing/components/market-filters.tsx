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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  getStatusLabelKey,
  MARKET_STATUSES,
  type MarketStatus,
} from '../lib/market'
import { MarketStatusDot } from './market-status'

export interface MarketFiltersProps {
  total: number
  vendors: { name: string; icon?: string; count: number }[]
  selectedVendors: string[]
  onToggleVendor: (vendor: string) => void
  onClearVendors: () => void
  groups: { name: string; ratio: number }[]
  group?: string
  onGroupChange: (group: string) => void
  statusCounts: Record<MarketStatus, number>
  selectedStatuses: MarketStatus[]
  onToggleStatus: (status: MarketStatus) => void
  className?: string
}

function FilterRow(props: { label: string; children: ReactNode }) {
  return (
    <div
      role='group'
      aria-label={props.label}
      className='flex items-start gap-3 py-2.5 not-first:border-t max-sm:flex-col max-sm:gap-2'
    >
      <span className='text-subtle-foreground w-16 shrink-0 pt-[5px] text-xs font-medium'>
        {props.label}
      </span>
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'>
        {props.children}
      </div>
    </div>
  )
}

function FilterChip(props: {
  checked: boolean
  radio?: boolean
  onSelect: () => void
  count?: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type='button'
      role={props.radio ? 'radio' : 'checkbox'}
      aria-checked={props.checked}
      onClick={props.onSelect}
      className={cn(
        'inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors',
        props.checked
          ? 'border-foreground bg-foreground text-background'
          : 'bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      )}
    >
      <span className='flex min-w-0 items-center gap-1.5 truncate'>
        {props.children}
      </span>
      {props.count != null && (
        <span
          className={cn(
            'font-mono text-[11px]',
            props.checked ? 'text-background/70' : 'text-subtle-foreground'
          )}
        >
          {props.count}
        </span>
      )}
    </button>
  )
}

export function MarketFilters(props: MarketFiltersProps) {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t('Filters')}
      className={cn('bg-card rounded-xl border px-4 py-1', props.className)}
    >
      <FilterRow label={t('Model vendor')}>
        <FilterChip
          checked={props.selectedVendors.length === 0}
          onSelect={props.onClearVendors}
          count={props.total}
        >
          {t('All')}
        </FilterChip>
        {props.vendors.map((vendor) => (
          <FilterChip
            key={vendor.name}
            checked={props.selectedVendors.includes(vendor.name)}
            onSelect={() => props.onToggleVendor(vendor.name)}
            count={vendor.count}
          >
            {vendor.icon && getLobeIcon(vendor.icon, 14)}
            <span className='truncate'>{vendor.name}</span>
          </FilterChip>
        ))}
      </FilterRow>

      {props.groups.length > 0 && (
        <FilterRow label={t('Pricing group')}>
          <div
            role='radiogroup'
            aria-label={t('Pricing group')}
            className='contents'
          >
            {props.groups.map((group) => (
              <FilterChip
                key={group.name}
                radio
                checked={props.group === group.name}
                onSelect={() => props.onGroupChange(group.name)}
                count={`×${group.ratio.toFixed(1)}`}
              >
                {group.name}
              </FilterChip>
            ))}
          </div>
          <span className='text-subtle-foreground text-[11.5px]'>
            {t(
              'Prices use the selected group ratio, and only models available in that group are shown'
            )}
          </span>
        </FilterRow>
      )}

      <FilterRow label={t('Status')}>
        {MARKET_STATUSES.map((status) => (
          <FilterChip
            key={status}
            checked={props.selectedStatuses.includes(status)}
            onSelect={() => props.onToggleStatus(status)}
            count={props.statusCounts[status]}
          >
            <MarketStatusDot status={status} />
            {t(getStatusLabelKey(status))}
          </FilterChip>
        ))}
      </FilterRow>
    </section>
  )
}

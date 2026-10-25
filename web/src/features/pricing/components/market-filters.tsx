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

import { cn } from '@/lib/utils'

import {
  getStatusLabelKey,
  MARKET_STATUSES,
  type MarketStatus,
} from '../lib/market'
import { MarketStatusDot } from './market-status'

export interface MarketFiltersProps {
  total: number
  vendors: { name: string; count: number }[]
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

function FilterTitle(props: { children: ReactNode; first?: boolean }) {
  return (
    <h4
      className={cn(
        'text-subtle-foreground mb-2 text-xs font-medium',
        !props.first && 'mt-[18px]'
      )}
    >
      {props.children}
    </h4>
  )
}

function FilterOption(props: {
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
      className='text-muted-foreground flex w-full cursor-pointer items-center gap-2 py-[5px] text-left text-[13.5px]'
    >
      <i
        aria-hidden
        className={cn(
          'border-input inline-block size-[15px] shrink-0 border-[1.5px]',
          props.radio ? 'rounded-full' : 'rounded-[4px]',
          props.checked &&
            'border-foreground bg-foreground shadow-[inset_0_0_0_2.5px_var(--card)]'
        )}
      />
      <span className='flex min-w-0 items-center gap-2 truncate'>
        {props.children}
      </span>
      {props.count != null && (
        <span className='text-subtle-foreground ml-auto font-mono text-[11.5px]'>
          {props.count}
        </span>
      )}
    </button>
  )
}

export function MarketFilters(props: MarketFiltersProps) {
  const { t } = useTranslation()

  return (
    <aside aria-label={t('Filters')} className={props.className}>
      <FilterTitle first>{t('Model vendor')}</FilterTitle>
      <FilterOption
        checked={props.selectedVendors.length === 0}
        onSelect={props.onClearVendors}
        count={props.total}
      >
        {t('All')}
      </FilterOption>
      {props.vendors.map((vendor) => (
        <FilterOption
          key={vendor.name}
          checked={props.selectedVendors.includes(vendor.name)}
          onSelect={() => props.onToggleVendor(vendor.name)}
          count={vendor.count}
        >
          {vendor.name}
        </FilterOption>
      ))}

      {props.groups.length > 0 && (
        <>
          <FilterTitle>{t('Pricing group')}</FilterTitle>
          <div role='radiogroup' aria-label={t('Pricing group')}>
            {props.groups.map((group) => (
              <FilterOption
                key={group.name}
                radio
                checked={props.group === group.name}
                onSelect={() => props.onGroupChange(group.name)}
                count={`×${group.ratio.toFixed(1)}`}
              >
                {group.name}
              </FilterOption>
            ))}
          </div>
          <p className='text-subtle-foreground mt-1 text-[11.5px] leading-normal'>
            {t(
              'Prices use the selected group ratio, and only models available in that group are shown'
            )}
          </p>
        </>
      )}

      <FilterTitle>{t('Status')}</FilterTitle>
      {MARKET_STATUSES.map((status) => (
        <FilterOption
          key={status}
          checked={props.selectedStatuses.includes(status)}
          onSelect={() => props.onToggleStatus(status)}
          count={props.statusCounts[status]}
        >
          <MarketStatusDot status={status} />
          {t(getStatusLabelKey(status))}
        </FilterOption>
      ))}
    </aside>
  )
}

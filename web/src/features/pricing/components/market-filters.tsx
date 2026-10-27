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
  MARKET_STATUS_FILTERS,
  type MarketStatusFilter,
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
  onClearGroup: () => void
  statusCounts: Record<MarketStatusFilter, number>
  status?: MarketStatusFilter
  onToggleStatus: (status: MarketStatusFilter) => void
  onClearStatus: () => void
  trailing?: ReactNode
  className?: string
}

// 倍率最多保留 3 位小数（最小可显示 0.001），去掉末尾多余的 0，整数保留一位小数
function formatGroupRatio(ratio: number) {
  const text = String(Number(ratio.toFixed(3)))
  return text.includes('.') ? text : ratio.toFixed(1)
}

const RATIO_TONE: Record<number, string> = {
  [-1]: 'bg-success/12 text-success',
  0: 'bg-muted text-foreground',
  1: 'bg-warning/15 text-warning',
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
  /** Group price ratio, shown as a tinted badge: green below 1, amber above. */
  ratio?: number
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
      {props.ratio != null && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px font-mono text-[11.5px] leading-4 font-semibold',
            props.checked
              ? 'bg-background/20 text-background'
              : RATIO_TONE[Math.sign(props.ratio - 1)]
          )}
        >
          ×{formatGroupRatio(props.ratio)}
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
            <FilterChip
              radio
              checked={!props.group}
              onSelect={props.onClearGroup}
              count={props.total}
            >
              {t('All')}
            </FilterChip>
            {props.groups.map((group) => (
              <FilterChip
                key={group.name}
                radio
                checked={props.group === group.name}
                onSelect={() => props.onGroupChange(group.name)}
                ratio={group.ratio}
              >
                {group.name}
              </FilterChip>
            ))}
          </div>
        </FilterRow>
      )}

      <FilterRow label={t('Status')}>
        <div role='radiogroup' aria-label={t('Status')} className='contents'>
          <FilterChip
            radio
            checked={!props.status}
            onSelect={props.onClearStatus}
            count={props.total}
          >
            {t('All')}
          </FilterChip>
          {/* The maintenance chip is hidden from the filter bar. */}
          {MARKET_STATUS_FILTERS.filter((status) => status !== 'bad').map(
            (status) => (
              <FilterChip
                key={status}
                radio
                checked={props.status === status}
                onSelect={() => props.onToggleStatus(status)}
                count={props.statusCounts[status]}
              >
                <MarketStatusDot status={status} />
                {t(getStatusLabelKey(status))}
              </FilterChip>
            )
          )}
        </div>
        {props.trailing && <div className='ml-auto'>{props.trailing}</div>}
      </FilterRow>
    </section>
  )
}

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
import { Image as ImageIcon, Search, SlidersHorizontal, Video } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  getStatusLabelKey,
  getVendorAvatar,
  MARKET_STATUS_FILTERS,
  type MarketStatusFilter,
} from '../lib/market'
import {
  getModalityLabelKey,
  MARKET_MODALITIES,
  type MarketModality,
} from '../lib/video-market'
import { MarketStatusDot } from './market-status'

export interface MarketFiltersProps {
  total: number
  searchInput: string
  onSearchChange: (value: string) => void
  searchRef?: RefObject<HTMLInputElement | null>
  modalityCounts?: Record<MarketModality, number>
  modality?: MarketModality
  onToggleModality?: (modality: MarketModality) => void
  onClearModality?: () => void
  vendors: { name: string; icon?: string; count: number }[]
  selectedVendors: string[]
  onToggleVendor: (vendor: string) => void
  onClearVendors: () => void
  statusCounts: Record<MarketStatusFilter, number>
  status?: MarketStatusFilter
  onToggleStatus: (status: MarketStatusFilter) => void
  onClearStatus: () => void
  mobileFiltersOpen?: boolean
  onToggleMobileFilters?: () => void
  className?: string
}

// 倍率最多保留 3 位小数（最小可显示 0.001），去掉末尾多余的 0，整数保留一位小数
export function formatGroupRatio(ratio: number) {
  const text = String(Number(ratio.toFixed(3)))
  return text.includes('.') ? text : ratio.toFixed(1)
}

export const RATIO_TONE: Record<number, string> = {
  [-1]: 'bg-success/12 text-success',
  0: 'bg-muted text-foreground',
  1: 'bg-warning/15 text-warning',
}

const STATUS_ACTIVE_CLASS: Record<MarketStatusFilter, string> = {
  ok: 'border-success/50 bg-success/12 text-success',
  warn: 'border-warning/50 bg-warning/12 text-warning',
  bad: 'border-indigo-500/50 bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
  none: 'border-foreground bg-foreground text-background',
}

function FilterChip(props: {
  checked: boolean
  radio?: boolean
  onSelect: () => void
  count?: ReactNode
  /** Group price ratio, shown as a tinted badge: green below 1, amber above. */
  ratio?: number
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type='button'
      role={props.radio ? 'radio' : 'checkbox'}
      aria-checked={props.checked}
      onClick={props.onSelect}
      className={cn(
        'inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors',
        props.checked
          ? 'border-foreground bg-foreground text-background'
          : 'bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        props.className
      )}
    >
      <span className='flex min-w-0 items-center gap-1.5 truncate'>
        {props.children}
      </span>
      {props.count != null && (
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            props.checked ? 'text-background/70' : 'text-subtle-foreground'
          )}
        >
          {props.count}
        </span>
      )}
      {props.ratio != null && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px font-mono text-[11px] leading-4 font-semibold',
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
  const activeModalities = props.modalityCounts
    ? MARKET_MODALITIES.filter((m) => (props.modalityCounts?.[m] ?? 0) > 0)
    : []
  const visibleStatuses = MARKET_STATUS_FILTERS.filter(
    (s) => (props.statusCounts[s] ?? 0) > 0 || props.status === s
  )

  return (
    <section
      aria-label={t('Filters')}
      className={cn(
        'bg-card space-y-2.5 rounded-xl border p-3',
        props.className
      )}
    >
      {/* Layer 1: Search Input + Modality Segmented Tabs on one compact row */}
      <div className='flex flex-col items-stretch gap-2.5 lg:flex-row lg:items-center'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {props.onToggleMobileFilters && (
            <button
              type='button'
              aria-expanded={props.mobileFiltersOpen}
              aria-label={t('Filter')}
              onClick={props.onToggleMobileFilters}
              className={cn(
                'bg-background text-muted-foreground hover:text-foreground hidden h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors max-sm:inline-flex',
                props.mobileFiltersOpen && 'border-foreground text-foreground'
              )}
            >
              <SlidersHorizontal aria-hidden className='size-3.5' />
              {t('Filter')}
            </button>
          )}
          <label className='relative min-w-0 flex-1'>
            <Search
              aria-hidden
              className='text-subtle-foreground absolute top-2.5 left-3 size-4'
              strokeWidth={2}
            />
            <input
              ref={props.searchRef}
              value={props.searchInput}
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder={t(
                'Search models, vendors, or capabilities (e.g. opus, muse, 60s, deepseek)'
              )}
              aria-label={t('Search models')}
              className='border-input bg-background focus:border-foreground focus:ring-primary/20 h-9 w-full rounded-lg border pr-9 pl-9 text-[13px] transition-[border-color,box-shadow] outline-none focus:ring-3'
            />
            <kbd className='text-subtle-foreground bg-card absolute top-2 right-2.5 rounded border px-1.5 py-px font-mono text-[10.5px]'>
              /
            </kbd>
          </label>
        </div>

        {activeModalities.length > 1 && props.onToggleModality && (
          <div
            role='radiogroup'
            aria-label={t('Model type')}
            className='bg-muted inline-flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg p-1'
          >
            <button
              type='button'
              role='radio'
              aria-checked={!props.modality}
              onClick={() => props.onClearModality?.()}
              className={cn(
                'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
                !props.modality
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{t('All')}</span>
              <span className='font-mono text-[11px] opacity-65 tabular-nums'>
                {props.total}
              </span>
            </button>
            {activeModalities.map((modality) => {
              const checked = props.modality === modality
              return (
                <button
                  key={modality}
                  type='button'
                  role='radio'
                  aria-checked={checked}
                  onClick={() => props.onToggleModality?.(modality)}
                  className={cn(
                    'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
                    checked
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {modality === 'video' && (
                    <Video aria-hidden className='size-3.5 shrink-0' />
                  )}
                  {modality === 'image' && (
                    <ImageIcon aria-hidden className='size-3.5 shrink-0' />
                  )}
                  <span>{t(getModalityLabelKey(modality))}</span>
                  <span className='font-mono text-[11px] opacity-65 tabular-nums'>
                    {props.modalityCounts?.[modality]}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Layer 2: Vendor Chips + Compact Right-Aligned Status Pills */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2.5 border-t pt-2.5',
          props.onToggleMobileFilters &&
            !props.mobileFiltersOpen &&
            'max-sm:hidden'
        )}
      >
        <div
          role='radiogroup'
          aria-label={t('Model vendor')}
          className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'
        >
          <span className='text-subtle-foreground mr-0.5 shrink-0 text-[11.5px] font-medium'>
            {t('Model vendor')}
          </span>
          <FilterChip
            radio
            checked={props.selectedVendors.length === 0}
            onSelect={props.onClearVendors}
            count={props.total}
          >
            {t('All')}
          </FilterChip>
          {props.vendors.map((vendor) => {
            const avatar = getVendorAvatar(vendor.name)
            return (
              <FilterChip
                key={vendor.name}
                radio
                checked={props.selectedVendors.includes(vendor.name)}
                onSelect={() => props.onToggleVendor(vendor.name)}
                count={vendor.count}
              >
                {vendor.icon ? (
                  getLobeIcon(vendor.icon, 14)
                ) : (
                  <span
                    aria-hidden
                    className='size-2 shrink-0 rounded-full'
                    style={{ backgroundColor: avatar.color }}
                  />
                )}
                <span className='truncate'>{vendor.name}</span>
              </FilterChip>
            )
          })}
        </div>

        {visibleStatuses.length > 0 && (
          <div
            role='radiogroup'
            aria-label={t('Status')}
            className='flex shrink-0 flex-wrap items-center gap-1.5'
          >
            <span className='text-subtle-foreground mr-0.5 text-[11.5px] font-medium'>
              {t('Status')}
            </span>
            {visibleStatuses.map((status) => {
              const checked = props.status === status
              return (
                <button
                  key={status}
                  type='button'
                  role='radio'
                  aria-checked={checked}
                  onClick={() => props.onToggleStatus(status)}
                  className={cn(
                    'inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    checked
                      ? STATUS_ACTIVE_CLASS[status]
                      : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                  )}
                >
                  <MarketStatusDot status={status} />
                  <span>{t(getStatusLabelKey(status))}</span>
                  <span className='font-mono text-[10.5px] opacity-75 tabular-nums'>
                    {props.statusCounts[status]}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

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
import { AlertCircle, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  LoadingSkeleton,
  ModelCardGrid,
  ModelDetailsDrawer,
  PricingTable,
} from './components'
import { MarketFilters } from './components/market-filters'
import { MarketSeg } from './components/market-seg'
import { PelicanDialog } from './components/pelican-dialog'
import { VIEW_MODES, type ViewMode } from './constants'
import { useFilters } from './hooks/use-filters'
import { useMarketPerf } from './hooks/use-market-perf'
import { usePricingData } from './hooks/use-pricing-data'
import {
  getDefaultMarketGroup,
  getMarketGroups,
  getStatusLabelKey,
  getStatusLevel,
  type MarketSort,
  type MarketStatus,
} from './lib/market'
import type { TokenUnit } from './types'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )
  const [testModelName, setTestModelName] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
  } = usePricingData()
  const perf = useMarketPerf()

  const groupNames = useMemo(() => getMarketGroups(usableGroup), [usableGroup])
  const defaultGroup = getDefaultMarketGroup(groupNames)
  const filters = useFilters(models, perf, defaultGroup)

  // "/" focuses the search box, as hinted by the kbd in the design.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        event.key !== '/' ||
        target?.closest('input, textarea, select, [contenteditable=true]')
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const vendorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const model of models) {
      if (model.vendor_name) {
        counts.set(model.vendor_name, (counts.get(model.vendor_name) ?? 0) + 1)
      }
    }
    const ordered = vendors
      .map((vendor) => vendor.name)
      .filter((name) => counts.has(name))
    return ordered.map((name) => ({ name, count: counts.get(name) ?? 0 }))
  }, [models, vendors])

  const statusCounts = useMemo(() => {
    const counts: Record<MarketStatus, number> = { ok: 0, warn: 0, bad: 0 }
    for (const model of models) {
      const status = getStatusLevel(perf.get(model.model_name)?.successRate)
      if (status) counts[status] += 1
    }
    return counts
  }, [models, perf])

  const groups = useMemo(
    () =>
      groupNames.map((name) => ({
        name,
        ratio: groupRatio[name] ?? usableGroup[name]?.ratio ?? 1,
      })),
    [groupNames, groupRatio, usableGroup]
  )

  const selectedModel = useMemo(
    () => models.find((model) => model.model_name === selectedModelName),
    [models, selectedModelName]
  )
  const testModel = useMemo(
    () => models.find((model) => model.model_name === testModelName) ?? null,
    [models, testModelName]
  )

  const chips: { key: string; label: string; onRemove: () => void }[] = []
  const query = filters.searchInput.trim()
  if (query) {
    chips.push({
      key: 'q',
      label: t('Search “{{query}}”', { query }),
      onRemove: filters.clearSearch,
    })
  }
  for (const vendor of filters.vendors) {
    chips.push({
      key: `v-${vendor}`,
      label: vendor,
      onRemove: () => filters.toggleVendor(vendor),
    })
  }
  for (const status of filters.statuses) {
    chips.push({
      key: `s-${status}`,
      label: t(getStatusLabelKey(status)),
      onRemove: () => filters.toggleStatus(status),
    })
  }
  if (filters.group && !filters.isDefaultGroup) {
    chips.push({
      key: 'g',
      label: t('Group {{name}} ×{{ratio}}', {
        name: filters.group,
        ratio: groupRatio[filters.group] ?? 1,
      }),
      onRemove: filters.resetGroup,
    })
  }

  const openModel = useCallback(
    (name: string) => setSelectedModelName(name),
    []
  )
  const openTest = useCallback((name: string) => setTestModelName(name), [])

  const shared = {
    models: filters.filteredModels,
    perf,
    priceRate,
    usdExchangeRate,
    tokenUnit: filters.tokenUnit,
    showRechargePrice: filters.showRechargePrice,
    selectedGroup: filters.group,
    onTest: openTest,
  }

  let content: React.ReactNode
  if (isLoading) {
    content = <LoadingSkeleton />
  } else if (error) {
    content = (
      <div className='bg-card text-subtle-foreground rounded-xl border px-5 py-16 text-center text-[13px] leading-relaxed'>
        <AlertCircle
          aria-hidden
          className='text-subtle-foreground mx-auto mb-2.5 size-7'
          strokeWidth={1.6}
        />
        <b className='text-destructive mb-1 block text-[15px]'>
          {t('Model list failed to load')}
        </b>
        {t(
          '/api/pricing returned an error or timed out, please try again later'
        )}
        <br />
        <Button
          size='sm'
          variant='outline'
          className='mt-3.5'
          onClick={() => void refetch()}
        >
          {t('Retry')}
        </Button>
      </div>
    )
  } else if (filters.filteredModels.length === 0) {
    content = (
      <div className='bg-card text-subtle-foreground rounded-xl border px-5 py-16 text-center text-[13px]'>
        <b className='text-foreground mb-1.5 block text-[15px]'>
          {t('No models match the filters')}
        </b>
        {t('Try another keyword, or loosen the filters on the left')}
        <br />
        <Button
          size='sm'
          variant='outline'
          className='mt-4'
          onClick={filters.clearAll}
        >
          {t('Reset all filters')}
        </Button>
      </div>
    )
  } else if (filters.viewMode === VIEW_MODES.TABLE) {
    content = <PricingTable {...shared} onModelClick={openModel} />
  } else {
    content = <ModelCardGrid {...shared} onModelClick={openModel} />
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-[1360px] px-6 pt-16 pb-16'>
        <div className='grid grid-cols-[220px_minmax(0,1fr)] gap-7 pt-8 max-[1000px]:grid-cols-[minmax(0,1fr)]'>
          <MarketFilters
            total={models.length}
            vendors={vendorCounts}
            selectedVendors={filters.vendors}
            onToggleVendor={filters.toggleVendor}
            onClearVendors={filters.clearVendors}
            groups={groups}
            group={filters.group}
            onGroupChange={filters.setGroup}
            statusCounts={statusCounts}
            selectedStatuses={filters.statuses}
            onToggleStatus={filters.toggleStatus}
            className={cn(
              'max-[1000px]:hidden',
              filtersOpen &&
                'max-[1000px]:bg-card max-[1000px]:block max-[1000px]:rounded-xl max-[1000px]:border max-[1000px]:p-4'
            )}
          />
          <div className='min-w-0'>
            <div className='mb-4 flex flex-wrap items-center gap-2.5'>
              <Button
                variant='outline'
                className='hidden max-[1000px]:inline-flex'
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                {t('Filter')}
              </Button>
              <label className='relative min-w-[200px] flex-1'>
                <Search
                  aria-hidden
                  className='text-subtle-foreground absolute top-3 left-3 size-4'
                  strokeWidth={2}
                />
                <input
                  ref={searchRef}
                  value={filters.searchInput}
                  onChange={(event) =>
                    filters.setSearchInput(event.target.value)
                  }
                  placeholder={t('Search models, e.g. claude, gpt, deepseek')}
                  aria-label={t('Search models')}
                  className='border-input bg-card focus:border-foreground focus:ring-primary/20 h-10 w-full rounded-lg border pr-10 pl-9 text-sm transition-[border-color,box-shadow] outline-none focus:ring-3'
                />
                <kbd className='text-subtle-foreground bg-background absolute top-2.5 right-2.5 rounded border px-1.5 py-px font-mono text-[11px]'>
                  /
                </kbd>
              </label>
              <MarketSeg<ViewMode>
                value={filters.viewMode}
                onChange={filters.setViewMode}
                aria-label={t('View')}
                options={[
                  { value: VIEW_MODES.CARD, label: t('Cards') },
                  { value: VIEW_MODES.TABLE, label: t('Table') },
                ]}
              />
              <MarketSeg<MarketSort>
                value={filters.sortBy}
                onChange={filters.setSortBy}
                aria-label={t('Sort')}
                options={[
                  { value: 'hot', label: t('Popular') },
                  { value: 'price', label: t('Price ↑') },
                  { value: 'new', label: t('Newest') },
                ]}
              />
            </div>

            <div className='mb-3.5 flex min-h-8 flex-wrap items-center justify-between gap-2.5'>
              <div className='text-subtle-foreground flex flex-wrap items-center gap-1.5 text-[13px]'>
                <span>
                  <Trans
                    i18nKey='Total <num>{{count}}</num> models'
                    values={{ count: filters.filteredModels.length }}
                    components={{
                      num: (
                        <b className='text-foreground font-mono font-medium' />
                      ),
                    }}
                  />
                </span>
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type='button'
                    onClick={chip.onRemove}
                    className='bg-muted text-foreground group inline-flex h-[26px] items-center gap-1.5 rounded-md pr-2 pl-2.5 text-[12.5px]'
                  >
                    {chip.label}
                    <i className='text-subtle-foreground group-hover:text-foreground not-italic'>
                      ×
                    </i>
                  </button>
                ))}
                {chips.length > 0 && (
                  <button
                    type='button'
                    onClick={filters.clearAll}
                    className='text-primary text-[12.5px]'
                  >
                    {t('Clear all')}
                  </button>
                )}
              </div>
              <div className='flex gap-2'>
                <MarketSeg
                  value={filters.showRechargePrice ? 'rch' : 'std'}
                  onChange={(value) =>
                    filters.setShowRechargePrice(value === 'rch')
                  }
                  aria-label={t('Price basis')}
                  options={[
                    { value: 'std', label: t('Standard rate') },
                    { value: 'rch', label: t('Recharge rate') },
                  ]}
                />
                <MarketSeg<TokenUnit>
                  value={filters.tokenUnit}
                  onChange={filters.setTokenUnit}
                  aria-label={t('Pricing unit')}
                  options={[
                    { value: 'M', label: '/ 1M' },
                    { value: 'K', label: '/ 1K' },
                  ]}
                />
              </div>
            </div>

            {content}
          </div>
        </div>
      </div>

      {selectedModel && (
        <ModelDetailsDrawer
          open
          onOpenChange={(open) => {
            if (!open) setSelectedModelName(null)
          }}
          model={selectedModel}
          groupRatio={groupRatio}
          usableGroup={usableGroup}
          endpointMap={
            endpointMap as Record<string, { path?: string; method?: string }>
          }
          autoGroups={autoGroups}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={filters.tokenUnit}
          showRechargePrice={filters.showRechargePrice}
        />
      )}
      <PelicanDialog
        model={testModel}
        groups={groupNames}
        defaultGroup={filters.group}
        onOpenChange={(open) => {
          if (!open) setTestModelName(null)
        }}
      />
    </PublicLayout>
  )
}

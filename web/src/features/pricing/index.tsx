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
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, LayoutGrid, List } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

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
  getGroupDescription,
  getMarketGroups,
  getModelMarketStatus,
  getStatusLabelKey,
  type MarketSort,
  type MarketStatusFilter,
} from './lib/market'
import {
  getModalityLabelKey,
  getModelModality,
  type MarketModality,
} from './lib/video-market'
import type { TokenUnit } from './types'

export function Pricing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const groupNames = useMemo(
    () => getMarketGroups(usableGroup, groupRatio),
    [usableGroup, groupRatio]
  )
  const defaultGroup = getDefaultMarketGroup(groupNames)
  const filters = useFilters(models, perf)

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
    return vendors
      .filter((vendor) => counts.has(vendor.name))
      .map((vendor) => ({
        name: vendor.name,
        icon: vendor.icon,
        count: counts.get(vendor.name) ?? 0,
      }))
  }, [models, vendors])

  const modalityCounts = useMemo(() => {
    const counts: Record<MarketModality, number> = {
      chat: 0,
      video: 0,
      image: 0,
    }
    for (const model of models) {
      counts[getModelModality(model)] += 1
    }
    return counts
  }, [models])

  const statusCounts = useMemo(() => {
    const counts: Record<MarketStatusFilter, number> = {
      ok: 0,
      warn: 0,
      bad: 0,
      none: 0,
    }
    for (const model of models) {
      counts[getModelMarketStatus(model, perf)] += 1
    }
    return counts
  }, [models, perf])

  const groups = useMemo(
    () =>
      groupNames.map((name) => ({
        name,
        ratio: groupRatio[name] ?? usableGroup[name]?.ratio ?? 1,
        desc: getGroupDescription(usableGroup, name),
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
  if (filters.modality) {
    chips.push({
      key: `m-${filters.modality}`,
      label: t(getModalityLabelKey(filters.modality)),
      onRemove: filters.clearModality,
    })
  }
  for (const vendor of filters.vendors) {
    chips.push({
      key: `v-${vendor}`,
      label: vendor,
      onRemove: () => filters.toggleVendor(vendor),
    })
  }
  if (filters.status) {
    chips.push({
      key: 's',
      label: t(getStatusLabelKey(filters.status)),
      onRemove: filters.clearStatus,
    })
  }
  if (filters.group) {
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
  const openStudio = useCallback(
    (modelName: string, kind: 'video' | 'image') => {
      void navigate({
        to: '/studio',
        search: { view: kind, model: modelName },
      })
    },
    [navigate]
  )

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
        {t('Try another keyword, or loosen the filters')}
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
    content = (
      <PricingTable
        {...shared}
        onModelClick={openModel}
        onOpenStudio={openStudio}
      />
    )
  } else {
    content = (
      <ModelCardGrid
        {...shared}
        sort={filters.sortBy}
        groups={groups}
        searchQuery={filters.searchInput}
        onGroupClick={(name) =>
          name === filters.group ? filters.resetGroup() : filters.setGroup(name)
        }
        onModelClick={openModel}
        onOpenStudio={openStudio}
      />
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-[1600px] px-4 pt-6 pb-16 md:px-7'>
        <div className='min-w-0'>
          {/* Compact Page Header & Global Utility Controls */}
          <div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center gap-2.5'>
                <h1 className='text-[22px] leading-none font-bold tracking-tight'>
                  {t('Model Plaza')}
                </h1>
                {!isLoading && models.length > 0 && (
                  <span className='bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] tabular-nums'>
                    <span
                      aria-hidden
                      className='bg-success size-1.5 rounded-full'
                    />
                    {t('{{models}} models · {{vendors}} vendors', {
                      models: models.length,
                      vendors: vendorCounts.length,
                    })}
                  </span>
                )}
              </div>
              <p className='text-subtle-foreground text-[12.5px]'>
                {t(
                  'Browse chat, video, and image models with 24h status, group ratios, and discounted pricing'
                )}
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <MarketSeg<MarketSort>
                value={filters.sortBy}
                onChange={filters.setSortBy}
                aria-label={t('Sort by')}
                options={[
                  { value: 'new', label: t('Default') },
                  { value: 'hot', label: t('Popular') },
                  { value: 'price', label: t('Lowest price') },
                ]}
              />
              <MarketSeg<TokenUnit>
                value={filters.tokenUnit}
                onChange={filters.setTokenUnit}
                aria-label={t('Token unit')}
                options={[
                  { value: 'M', label: '/1M', className: 'font-mono px-2' },
                  { value: 'K', label: '/1K', className: 'font-mono px-2' },
                ]}
              />
              <MarketSeg<ViewMode>
                value={filters.viewMode}
                onChange={filters.setViewMode}
                aria-label={t('View')}
                options={[
                  {
                    value: VIEW_MODES.CARD,
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <LayoutGrid aria-hidden className='size-3.5' />
                        {t('Cards')}
                      </span>
                    ),
                  },
                  {
                    value: VIEW_MODES.TABLE,
                    label: (
                      <span className='inline-flex items-center gap-1'>
                        <List aria-hidden className='size-3.5' />
                        {t('Table')}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          <MarketFilters
            total={models.length}
            searchInput={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            searchRef={searchRef}
            modalityCounts={modalityCounts}
            modality={filters.modality}
            onToggleModality={filters.toggleModality}
            onClearModality={filters.clearModality}
            vendors={vendorCounts}
            selectedVendors={filters.vendors}
            onToggleVendor={filters.toggleVendor}
            onClearVendors={filters.clearVendors}
            statusCounts={statusCounts}
            status={filters.status}
            onToggleStatus={filters.toggleStatus}
            onClearStatus={filters.clearStatus}
            mobileFiltersOpen={filtersOpen}
            onToggleMobileFilters={() => setFiltersOpen((prev) => !prev)}
            className='mb-4'
          />

          <div className='mb-3.5 flex min-h-7 flex-wrap items-center justify-between gap-2.5'>
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
                  className='bg-muted text-foreground group inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-md pr-2 pl-2.5 text-[12.5px]'
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
                  className='text-primary cursor-pointer text-[12.5px] hover:underline'
                >
                  {t('Clear all')}
                </button>
              )}
            </div>
          </div>

          {content}
        </div>
      </div>

      {selectedModel && (
        <ModelDetailsDrawer
          open
          onOpenChange={(open) => {
            if (!open) setSelectedModelName(null)
          }}
          model={selectedModel}
          allModels={models}
          onSelectModel={openModel}
          onOpenStudio={openStudio}
          onTest={openTest}
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
        defaultGroup={filters.group ?? defaultGroup}
        onOpenChange={(open) => {
          if (!open) setTestModelName(null)
        }}
      />
    </PublicLayout>
  )
}

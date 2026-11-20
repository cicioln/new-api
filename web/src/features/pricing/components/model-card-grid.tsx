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
import { memo, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import type { MarketPerf, MarketSort } from '../lib/market'
import {
  getFamilyColor,
  parseModelName,
  type ParsedModelName,
} from '../lib/model-name'
import { getVideoSeriesInfo, isVideoModel } from '../lib/video-market'
import type { PricingModel, TokenUnit } from '../types'
import { formatGroupRatio, RATIO_TONE } from './market-filters'
import { VendorAvatar } from './market-parts'
import { ModelCard } from './model-card'
import {
  VideoSeriesCard,
  VideoSingleCard,
  type VideoTierEntry,
} from './video-model-card'

export interface ModelCardGridProps {
  models: PricingModel[]
  perf: Map<string, MarketPerf>
  onModelClick: (modelName: string) => void
  onTest?: (modelName: string) => void
  onOpenStudio?: (modelName: string, kind: 'video' | 'image') => void
  searchQuery?: string
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  sort?: MarketSort
  /** Pricing groups shown in the market, in display order. */
  groups?: { name: string; ratio: number }[]
  /** Toggles the group filter; clicking the selected group clears it. */
  onGroupClick?: (group: string) => void
}

type Entry = { model: PricingModel; parsed: ParsedModelName; latest: boolean }

type VendorSection = {
  vendor: string
  icon?: string
  entries: Entry[]
  families: ParsedModelName[]
  groups: { name: string; ratio: number }[]
  maintenance: number
}

/**
 * Splits models into vendor sections with a fixed order that does not depend
 * on creation time or traffic: vendors and families by name, and inside a
 * family the newest version first. Sorting by price keeps the price order
 * inside each section. Models under maintenance always go last.
 */
function buildSections(
  models: PricingModel[],
  sort: MarketSort | undefined,
  groups: { name: string; ratio: number }[]
): VendorSection[] {
  const sections = new Map<string, VendorSection>()
  for (const model of models) {
    const vendor = model.vendor_name ?? ''
    let section = sections.get(vendor)
    if (!section) {
      section = {
        vendor,
        icon: model.vendor_icon || undefined,
        entries: [],
        families: [],
        groups: [],
        maintenance: 0,
      }
      sections.set(vendor, section)
    }
    section.entries.push({
      model,
      parsed: parseModelName(model.model_name),
      latest: false,
    })
  }

  for (const section of sections.values()) {
    const enabled = new Set(
      section.entries.flatMap((e) => e.model.enable_groups ?? [])
    )
    section.groups = groups.filter((group) => enabled.has(group.name))

    // Families are ordered by name, not by which model happens to come first,
    // so adding or re-timestamping a model never reshuffles the section.
    const familyByKey = new Map<string, ParsedModelName>()
    for (const entry of section.entries) {
      if (!familyByKey.has(entry.parsed.family)) {
        familyByKey.set(entry.parsed.family, entry.parsed)
      }
    }
    section.families = [...familyByKey.values()].sort((a, b) =>
      compareText(a.family, b.family)
    )
    const familyOrder = new Map(
      section.families.map((family, index) => [family.family, index])
    )

    // The newest plain version (no Flash / Thinking / date suffix) of each
    // family gets the "Latest" badge.
    const newest = new Map<string, Entry>()
    for (const entry of section.entries) {
      if (entry.parsed.tags.length > 0 || !entry.parsed.version) continue
      const current = newest.get(entry.parsed.family)
      if (!current || entry.parsed.versionNum > current.parsed.versionNum) {
        newest.set(entry.parsed.family, entry)
      }
    }
    for (const [family, entry] of newest) {
      const versions = section.entries.filter(
        (e) => e.parsed.family === family && e.parsed.version
      )
      if (versions.length > 1) entry.latest = true
    }

    // Fixed card order: family by name, newest version first, plain models
    // before tagged variants, then the model ID as the final tie-break.
    if (sort !== 'price') {
      section.entries.sort(
        (a, b) =>
          (familyOrder.get(a.parsed.family) ?? 0) -
            (familyOrder.get(b.parsed.family) ?? 0) ||
          b.parsed.versionNum - a.parsed.versionNum ||
          a.parsed.tags.length - b.parsed.tags.length ||
          compareText(a.model.model_name, b.model.model_name)
      )
    }

    // A stable sort keeps the order above within each half.
    section.entries.sort(
      (a, b) => Number(!!a.model.maintenance) - Number(!!b.model.maintenance)
    )
    section.maintenance = section.entries.filter(
      (e) => e.model.maintenance
    ).length
  }

  // Vendors in name order; unknown vendors go last.
  return [...sections.values()].sort(
    (a, b) =>
      Number(!a.vendor) - Number(!b.vendor) || compareText(a.vendor, b.vendor)
  )
}

/** Locale-independent name order, so every viewer sees the same layout. */
function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })
}

type VideoSeriesGroup = {
  key: string
  title: string
  tiers: VideoTierEntry[]
}

/**
 * Splits a section's entries into collapsible multi-duration video series
 * (e.g. muse-video-10s..60s -> 1 VideoSeriesCard spanning 2 cols) and the
 * remaining individual entries.
 */
function groupSectionVideoSeries(entries: Entry[]): {
  series: VideoSeriesGroup[]
  otherEntries: Entry[]
  collapsibleTierCount: number
} {
  const byKey = new Map<string, { title: string; entries: (Entry & { durationSec: number })[] }>()
  for (const entry of entries) {
    const info = getVideoSeriesInfo(entry.model)
    if (!info) continue
    let bucket = byKey.get(info.key)
    if (!bucket) {
      bucket = { title: info.title, entries: [] }
      byKey.set(info.key, bucket)
    }
    bucket.entries.push({ ...entry, durationSec: info.durationSec })
  }

  const collapsedModelNames = new Set<string>()
  const series: VideoSeriesGroup[] = []
  let collapsibleTierCount = 0

  for (const [key, bucket] of byKey) {
    const distinctDurations = new Set(bucket.entries.map((e) => e.durationSec))
    if (distinctDurations.size < 2) continue
    const tiers = [...bucket.entries]
      .sort((a, b) => a.durationSec - b.durationSec)
      .map((e): VideoTierEntry => ({
        model: e.model,
        durationSec: e.durationSec,
      }))
    for (const tier of tiers) collapsedModelNames.add(tier.model.model_name)
    collapsibleTierCount += tiers.length
    series.push({ key, title: bucket.title, tiers })
  }

  series.sort((a, b) => compareText(a.title, b.title))
  const otherEntries = entries.filter(
    (entry) => !collapsedModelNames.has(entry.model.model_name)
  )

  return { series, otherEntries, collapsibleTierCount }
}

export const ModelCardGrid = memo(function ModelCardGrid(
  props: ModelCardGridProps
) {
  const { t } = useTranslation()
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})
  const sections = useMemo(
    () => buildSections(props.models, props.sort, props.groups ?? []),
    [props.models, props.sort, props.groups]
  )

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-7'>
      {sections.map((section) => {
        const grouped = groupSectionVideoSeries(section.entries)
        const hasSeries = grouped.series.length > 0
        const expanded = Boolean(expandedSections[section.vendor])
        const toggleExpand = () =>
          setExpandedSections((prev) => ({
            ...prev,
            [section.vendor]: !prev[section.vendor],
          }))

        // In expanded mode, show video duration tiers sorted ascending first,
        // then remaining models in their regular order.
        const expandedEntries = expanded
          ? [
              ...grouped.series.flatMap((s) =>
                s.tiers.map((tier) => ({
                  model: tier.model,
                  latest: false,
                }))
              ),
              ...grouped.otherEntries,
            ]
          : []

        return (
          <section
            key={section.vendor}
            aria-label={section.vendor || t('Other')}
            className='flex flex-col gap-3'
          >
            <header className='flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b pb-2'>
              <VendorAvatar
                name={section.vendor || '?'}
                icon={section.icon}
                className='size-6 rounded-md text-[11px]'
              />
              <h3 className='text-[15px] font-semibold'>
                {section.vendor || t('Other')}
              </h3>
              <span className='text-subtle-foreground text-xs tabular-nums'>
                {t('{{count}} models', { count: section.entries.length })}
              </span>
              {section.maintenance > 0 && (
                <span className='inline-flex h-5 items-center rounded-full bg-indigo-500/12 px-2 text-[11px] font-medium text-indigo-600 dark:text-indigo-400'>
                  {t('{{count}} under maintenance', {
                    count: section.maintenance,
                  })}
                </span>
              )}
              {section.groups.map((group) => {
                const checked = props.selectedGroup === group.name
                return (
                  <button
                    key={group.name}
                    type='button'
                    aria-pressed={checked}
                    onClick={() => props.onGroupClick?.(group.name)}
                    className={cn(
                      'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border pr-1 pl-3 text-[12.5px] font-medium antialiased transition-colors',
                      checked
                        ? 'border-foreground bg-foreground text-background'
                        : 'bg-card text-foreground/85 border-foreground/15 hover:border-foreground/40 hover:text-foreground'
                    )}
                  >
                    {group.name}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px font-mono text-[11px] leading-4 font-semibold',
                        checked
                          ? 'bg-background/20 text-background'
                          : RATIO_TONE[Math.sign(group.ratio - 1)]
                      )}
                    >
                      ×{formatGroupRatio(group.ratio)}
                    </span>
                  </button>
                )
              })}
              {hasSeries && (
                <button
                  type='button'
                  onClick={toggleExpand}
                  className='bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground ml-auto inline-flex h-7 cursor-pointer items-center rounded-lg border px-2.5 text-xs font-medium transition-colors'
                >
                  {expanded
                    ? t('Collapse to series card')
                    : t('Expand all {{count}} duration tiers', {
                        count: grouped.collapsibleTierCount,
                      })}
                </button>
              )}
              {!hasSeries && section.families.length > 1 && (
                <span className='text-muted-foreground ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs'>
                  {section.families.map((family) => (
                    <span
                      key={family.family}
                      className='inline-flex items-center gap-1.5'
                      style={
                        { '--family': getFamilyColor(family) } as CSSProperties
                      }
                    >
                      <i
                        aria-hidden
                        className='size-2 rounded-[2px] bg-(--family)'
                      />
                      {family.label}
                    </span>
                  ))}
                </span>
              )}
            </header>
            <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {hasSeries && !expanded
                ? (
                  <>
                    {grouped.series.map((series) => (
                      <VideoSeriesCard
                        key={series.key}
                        title={series.title}
                        tiers={series.tiers}
                        perf={props.perf}
                        tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
                        priceRate={props.priceRate}
                        usdExchangeRate={props.usdExchangeRate}
                        showRechargePrice={props.showRechargePrice}
                        selectedGroup={props.selectedGroup}
                        searchQuery={props.searchQuery}
                        onClick={props.onModelClick}
                        onOpenStudio={props.onOpenStudio}
                        className='sm:col-span-2'
                      />
                    ))}
                    {grouped.otherEntries.map(({ model, latest }) =>
                      isVideoModel(model) ? (
                        <VideoSingleCard
                          key={model.id ?? model.model_name}
                          model={model}
                          tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
                          priceRate={props.priceRate}
                          usdExchangeRate={props.usdExchangeRate}
                          showRechargePrice={props.showRechargePrice}
                          selectedGroup={props.selectedGroup}
                          perf={props.perf.get(model.model_name)}
                          onClick={props.onModelClick}
                          onOpenStudio={props.onOpenStudio}
                        />
                      ) : (
                        <ModelCard
                          key={model.id ?? model.model_name}
                          model={model}
                          latest={latest}
                          tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
                          priceRate={props.priceRate}
                          usdExchangeRate={props.usdExchangeRate}
                          showRechargePrice={props.showRechargePrice}
                          selectedGroup={props.selectedGroup}
                          perf={props.perf.get(model.model_name)}
                          onClick={props.onModelClick}
                          onTest={props.onTest}
                          onOpenStudio={props.onOpenStudio}
                        />
                      )
                    )}
                  </>
                )
                : (expanded ? expandedEntries : section.entries).map(
                    ({ model, latest }) =>
                      isVideoModel(model) ? (
                        <VideoSingleCard
                          key={model.id ?? model.model_name}
                          model={model}
                          tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
                          priceRate={props.priceRate}
                          usdExchangeRate={props.usdExchangeRate}
                          showRechargePrice={props.showRechargePrice}
                          selectedGroup={props.selectedGroup}
                          perf={props.perf.get(model.model_name)}
                          onClick={props.onModelClick}
                          onOpenStudio={props.onOpenStudio}
                        />
                      ) : (
                        <ModelCard
                          key={model.id ?? model.model_name}
                          model={model}
                          latest={latest}
                          tokenUnit={props.tokenUnit ?? DEFAULT_TOKEN_UNIT}
                          priceRate={props.priceRate}
                          usdExchangeRate={props.usdExchangeRate}
                          showRechargePrice={props.showRechargePrice}
                          selectedGroup={props.selectedGroup}
                          perf={props.perf.get(model.model_name)}
                          onClick={props.onModelClick}
                          onTest={props.onTest}
                          onOpenStudio={props.onOpenStudio}
                        />
                      )
                  )}
            </div>
          </section>
        )
      })}
    </div>
  )
})

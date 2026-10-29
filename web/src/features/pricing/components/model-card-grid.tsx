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
import { memo, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import type { MarketPerf, MarketSort } from '../lib/market'
import {
  getFamilyColor,
  parseModelName,
  type ParsedModelName,
} from '../lib/model-name'
import type { PricingModel, TokenUnit } from '../types'
import { formatGroupRatio, RATIO_TONE } from './market-filters'
import { VendorAvatar } from './market-parts'
import { ModelCard } from './model-card'

export interface ModelCardGridProps {
  models: PricingModel[]
  perf: Map<string, MarketPerf>
  onModelClick: (modelName: string) => void
  onTest?: (modelName: string) => void
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
}

/**
 * Splits models into vendor sections in the order the current sort puts
 * them. Unless sorting by price, cards inside a section are clustered by
 * family with the newest version first.
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

    const familyOrder = new Map<string, number>()
    for (const entry of section.entries) {
      if (!familyOrder.has(entry.parsed.family)) {
        familyOrder.set(entry.parsed.family, familyOrder.size)
        section.families.push(entry.parsed)
      }
    }

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

    if (sort !== 'price') {
      const index = new Map(section.entries.map((e, i) => [e, i]))
      section.entries.sort(
        (a, b) =>
          (familyOrder.get(a.parsed.family) ?? 0) -
            (familyOrder.get(b.parsed.family) ?? 0) ||
          b.parsed.versionNum - a.parsed.versionNum ||
          a.parsed.tags.length - b.parsed.tags.length ||
          (index.get(a) ?? 0) - (index.get(b) ?? 0)
      )
    }
  }

  // Unknown vendors go last.
  return [...sections.values()].sort(
    (a, b) => Number(!a.vendor) - Number(!b.vendor)
  )
}

export const ModelCardGrid = memo(function ModelCardGrid(
  props: ModelCardGridProps
) {
  const { t } = useTranslation()
  const sections = useMemo(
    () => buildSections(props.models, props.sort, props.groups ?? []),
    [props.models, props.sort, props.groups]
  )

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-7'>
      {sections.map((section) => (
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
            {section.groups.map((group) => {
              const checked = props.selectedGroup === group.name
              return (
                <button
                  key={group.name}
                  type='button'
                  aria-pressed={checked}
                  onClick={() => props.onGroupClick?.(group.name)}
                  className={cn(
                    'inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border pr-1 pl-2.5 text-xs transition-colors',
                    checked
                      ? 'border-foreground bg-foreground text-background'
                      : 'bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
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
            {section.families.length > 1 && (
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
            {section.entries.map(({ model, latest }) => (
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
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
})

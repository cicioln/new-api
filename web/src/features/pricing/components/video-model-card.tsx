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
import {
  ChevronRight,
  Clock,
  Film,
  Image as ImageIcon,
  Play,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT, QUOTA_TYPE_VALUES } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  getVendorAvatar,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import { getFamilyColor, parseModelName } from '../lib/model-name'
import { formatRequestPrice, formatRequestPricePerUnit } from '../lib/price'
import {
  formatExactSeconds,
  formatTimecode,
  getImageDisplayTitle,
  getVideoDisplayTitle,
  parseImageMetadata,
  parseVideoDurationSeconds,
  parseVideoMetadata,
} from '../lib/video-market'
import type { PricingModel, TokenUnit } from '../types'
import { MarketGroupTags } from './market-parts'
import { MarketSuccessRate } from './market-status'

const MAINTENANCE_DIM_CLASS = 'opacity-55 grayscale'
const MAINTENANCE_STRIPES =
  'repeating-linear-gradient(135deg, transparent 0 10px, rgb(99 102 241 / 0.04) 10px 20px)'

function useVideoMaintenanceRecovery(until: number | undefined): string {
  const { t } = useTranslation()
  if (!until) return t('Recovery time to be determined')
  const time = dayjs.unix(until)
  const text = time.isSame(dayjs(), 'day')
    ? t('Today {{time}}', { time: time.format('HH:mm') })
    : time.format('MM-DD HH:mm')
  return t('Expected recovery {{time}}', { time: text })
}

function VideoMaintenanceRibbon(props: { note?: string; until?: number }) {
  const { t } = useTranslation()
  const recovery = useVideoMaintenanceRecovery(props.until)
  return (
    <div
      role='status'
      className='flex items-start gap-2 rounded-[9px] bg-indigo-500/10 px-2.5 py-2 text-xs text-indigo-600 dark:text-indigo-400'
    >
      <Clock
        aria-hidden
        className='mt-0.5 size-3.5 shrink-0'
        strokeWidth={2.2}
      />
      <div className='min-w-0'>
        <b className='block font-semibold break-words'>
          {props.note || t('Under maintenance, service paused')}
        </b>
        <div className='text-[11.5px] opacity-80'>{recovery}</div>
      </div>
    </div>
  )
}

export function cinemaBackdropStyle(accent: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(125% 95% at 90% 10%, color-mix(in srgb, ${accent} 32%, transparent) 0%, transparent 56%), radial-gradient(95% 95% at 10% 90%, rgb(168 85 247 / 0.2) 0%, transparent 58%), linear-gradient(145deg, #12141a 0%, #1b1c23 55%, #161317 100%)`,
  }
}

export function imageBackdropStyle(accent = '#A855F7'): CSSProperties {
  return {
    backgroundImage: `radial-gradient(125% 95% at 90% 10%, color-mix(in srgb, ${accent} 34%, transparent) 0%, transparent 58%), radial-gradient(95% 95% at 10% 90%, rgb(236 72 153 / 0.22) 0%, transparent 60%), linear-gradient(145deg, #15121d 0%, #1d1727 55%, #17131c 100%)`,
  }
}

export const CINEMA_GRID_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.04) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
}

export function resolveVideoAccent(model: PricingModel): string {
  if (/muse/i.test(model.model_name) || /muse/i.test(model.vendor_name ?? '')) {
    return '#FF5A1F'
  }
  const parsed = parseModelName(model.model_name)
  if (parsed.family) {
    return getFamilyColor(parsed)
  }
  return getVendorAvatar(getVendorAvatarName(model)).color
}

function filterValidGroups(model: PricingModel): string[] {
  return (model.enable_groups || []).filter(
    (group) => !model.group_ratio || Object.hasOwn(model.group_ratio, group)
  )
}

export type VideoTierEntry = {
  model: PricingModel
  durationSec: number
}

export interface VideoSeriesCardProps {
  title: string
  tiers: VideoTierEntry[]
  perf: Map<string, MarketPerf>
  onClick: (modelName: string) => void
  onOpenStudio?: (modelName: string, kind: 'video' | 'image') => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  /** Optional search text; if it matches a specific tier, pre-select it. */
  searchQuery?: string
  className?: string
}

export const VideoSeriesCard = memo(function VideoSeriesCard(
  props: VideoSeriesCardProps
) {
  const { t } = useTranslation()
  const sortedTiers = useMemo(
    () => [...props.tiers].sort((a, b) => a.durationSec - b.durationSec),
    [props.tiers]
  )
  const defaultSec = useMemo(() => {
    const q = props.searchQuery?.trim().toLowerCase()
    if (q) {
      const matched = sortedTiers.find((tier) =>
        tier.model.model_name.toLowerCase().includes(q)
      )
      if (matched) return matched.durationSec
    }
    const thirty = sortedTiers.find(
      (tier) => tier.durationSec === 30 && !tier.model.maintenance
    )
    if (thirty) return thirty.durationSec
    const firstActive = sortedTiers.find((tier) => !tier.model.maintenance)
    return firstActive?.durationSec ?? sortedTiers[0]?.durationSec ?? 10
  }, [sortedTiers, props.searchQuery])

  const [selectedSec, setSelectedSec] = useState(defaultSec)
  useEffect(() => {
    if (!sortedTiers.some((tier) => tier.durationSec === selectedSec)) {
      setSelectedSec(defaultSec)
    }
  }, [sortedTiers, selectedSec, defaultSec])

  useEffect(() => {
    const q = props.searchQuery?.trim().toLowerCase()
    if (!q) return
    const matched = sortedTiers.find((tier) =>
      tier.model.model_name.toLowerCase().includes(q)
    )
    if (matched) setSelectedSec(matched.durationSec)
  }, [props.searchQuery, sortedTiers])

  const activeTier =
    sortedTiers.find((tier) => tier.durationSec === selectedSec) ??
    sortedTiers[0]
  const activeModel = activeTier.model
  const maxDurationSec =
    sortedTiers[sortedTiers.length - 1]?.durationSec ?? activeTier.durationSec

  // Prefer metadata from any tier that carries a rich description (e.g. 20s-60s).
  const richModel = useMemo(
    () =>
      sortedTiers.find((tier) => Boolean(tier.model.description))?.model ??
      activeModel,
    [sortedTiers, activeModel]
  )
  const meta = useMemo(() => parseVideoMetadata(richModel), [richModel])
  const accent = resolveVideoAccent(activeModel)
  const activePerf = props.perf.get(activeModel.model_name)
  const groups = filterValidGroups(activeModel)
  const maintenance = activeModel.maintenance
  const dim = maintenance ? MAINTENANCE_DIM_CLASS : undefined

  const prices = useMarketPrice(activeModel, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  const primaryPrice =
    activeModel.quota_type === QUOTA_TYPE_VALUES.REQUEST
      ? (prices.find((p) => p.key === 'price') ?? prices[0])
      : prices[0]

  const perSecondPrice = formatRequestPricePerUnit(
    activeModel,
    activeTier.durationSec,
    props.showRechargePrice ?? false,
    props.priceRate ?? 1,
    props.usdExchangeRate ?? 1,
    props.selectedGroup,
    true,
    2
  )

  const fillPct = Math.min(
    100,
    Math.max(12, Math.round((activeTier.durationSec / maxDurationSec) * 100))
  )

  return (
    <article
      aria-label={props.title}
      className={cn(
        'group/market bg-card hover:shadow-card relative grid min-w-0 grid-cols-1 overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-150 md:grid-cols-12',
        maintenance ? 'border-indigo-500/35' : 'hover:border-(--family)/45',
        props.className
      )}
      style={
        {
          '--family': accent,
          ...(maintenance && { backgroundImage: MAINTENANCE_STRIPES }),
        } as CSSProperties
      }
    >
      {/* Left Cinema Visual Panel */}
      <div
        className={cn(
          'relative flex min-h-[215px] flex-col justify-between overflow-hidden p-4 text-white md:col-span-5',
          dim
        )}
        style={cinemaBackdropStyle(accent)}
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0'
          style={CINEMA_GRID_STYLE}
        />

        <div className='relative z-10 flex items-center justify-between gap-2'>
          <span className='inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-xs'>
            <span
              aria-hidden
              className='size-1.5 rounded-full'
              style={{
                backgroundColor: maintenance ? '#818cf8' : '#34d399',
              }}
            />
            {t('Video · {{count}} tiers', { count: sortedTiers.length })}
          </span>
          {meta.specLine && (
            <span className='rounded border border-white/10 bg-black/35 px-2 py-0.5 font-mono text-[10.5px] text-white/80'>
              {meta.specLine}
            </span>
          )}
        </div>

        {/* Minimal 16:9 Cinema Frame Motif */}
        <div className='relative z-10 my-3 flex items-center justify-center'>
          <div className='flex aspect-video w-full max-w-[205px] flex-col justify-between rounded-xl border border-white/15 bg-black/35 p-2.5 backdrop-blur-xs'>
            <div className='flex items-center justify-between font-mono text-[10px] text-white/65'>
              <span>16:9 / 9:16</span>
              {meta.hasAudio && (
                <span className='inline-flex items-center gap-1 text-emerald-400'>
                  <span
                    aria-hidden
                    className='inline-flex h-2 items-end gap-[1.5px]'
                  >
                    <span className='h-1.5 w-[1.5px] rounded-full bg-emerald-400' />
                    <span className='h-2 w-[1.5px] rounded-full bg-emerald-400' />
                    <span className='h-1 w-[1.5px] rounded-full bg-emerald-400' />
                  </span>
                  {t('Native audio')}
                </span>
              )}
            </div>
            <div className='flex items-center justify-center'>
              <span
                aria-hidden
                className='grid size-9 place-items-center rounded-full text-white shadow-lg'
                style={{ backgroundColor: accent }}
              >
                <Play className='size-4 translate-x-px fill-current' />
              </span>
            </div>
            <div className='space-y-1'>
              <div className='h-1 w-full overflow-hidden rounded-full bg-white/15'>
                <div
                  className='h-full rounded-full transition-[width] duration-300'
                  style={{ width: `${fillPct}%`, backgroundColor: accent }}
                />
              </div>
              <div className='flex justify-between font-mono text-[10px] text-white/70 tabular-nums'>
                <span>00:00</span>
                <span className='font-semibold text-white'>
                  {formatTimecode(activeTier.durationSec)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className='relative z-10 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/70'>
          <span className='truncate'>
            {meta.supportsContinue
              ? t('Text · Image · Continuation')
              : t('Text & Image to Video')}
          </span>
          <span className='font-mono text-white/90'>MP4</span>
        </div>
      </div>

      {/* Right Interactive Selector, Metrics & Pricing */}
      <div className='flex min-w-0 flex-col gap-3 p-4 md:col-span-7'>
        <div className='flex items-start justify-between gap-2'>
          <div className={cn('min-w-0', dim)}>
            <div className='flex flex-wrap items-center gap-2'>
              <strong className='text-[18px] leading-tight font-bold tracking-[-0.01em]'>
                {props.title}
              </strong>
              {meta.hasAudio && (
                <span className='inline-flex h-5 items-center rounded-full bg-(--family)/12 px-2 text-[11px] font-medium text-(--family)'>
                  {t('Audio Video')}
                </span>
              )}
              {maintenance && (
                <span className='inline-flex h-5 items-center gap-1 rounded-md bg-indigo-500/12 px-2 text-[11px] font-medium text-indigo-600 dark:text-indigo-400'>
                  <Wrench aria-hidden className='size-3' strokeWidth={2.4} />
                  {t('Under maintenance')}
                </span>
              )}
            </div>
            <div className='mt-1 flex items-center gap-1'>
              <span
                title={activeModel.model_name}
                className='bg-muted text-muted-foreground inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11.5px] font-medium'
              >
                <span className='truncate'>{activeModel.model_name}</span>
                <CopyButton
                  value={activeModel.model_name}
                  aria-label={t('Copy model name')}
                  className='text-subtle-foreground hover:text-foreground size-4 rounded'
                  iconClassName='size-3'
                />
              </span>
            </div>
          </div>
          <button
            type='button'
            aria-label={t('Details')}
            title={t('Details')}
            onClick={() => props.onClick(activeModel.model_name)}
            className='text-muted-foreground hover:border-foreground/30 hover:text-foreground inline-flex h-7 shrink-0 cursor-pointer items-center gap-0.5 rounded-lg border px-2 text-xs transition-colors'
          >
            {t('Details')}
            <ChevronRight aria-hidden className='size-3.5' strokeWidth={2} />
          </button>
        </div>

        {/* Duration Tier Selector */}
        <div
          role='radiogroup'
          aria-label={t('Video duration tiers')}
          className={cn(
            'grid gap-1.5',
            sortedTiers.length >= 4
              ? 'grid-cols-3 sm:grid-cols-6'
              : 'grid-cols-3'
          )}
        >
          {sortedTiers.map((tier) => {
            const active = tier.durationSec === activeTier.durationSec
            const tierPrice =
              tier.model.quota_type === QUOTA_TYPE_VALUES.REQUEST
                ? formatRequestPrice(
                    tier.model,
                    props.showRechargePrice ?? false,
                    props.priceRate ?? 1,
                    props.usdExchangeRate ?? 1,
                    props.selectedGroup,
                    true,
                    2
                  )
                : undefined
            return (
              <button
                key={tier.model.model_name}
                type='button'
                role='radio'
                aria-checked={active}
                onClick={() => setSelectedSec(tier.durationSec)}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-colors',
                  active
                    ? 'border-(--family) bg-(--family)/12 text-(--family)'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  tier.model.maintenance && 'opacity-55'
                )}
              >
                <span className='font-mono text-xs leading-tight font-bold tabular-nums'>
                  {tier.durationSec}s
                </span>
                {tierPrice && (
                  <span className='mt-0.5 font-mono text-[10px] leading-tight opacity-85 tabular-nums'>
                    {tierPrice}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {maintenance && (
          <VideoMaintenanceRibbon
            note={maintenance.note}
            until={maintenance.until}
          />
        )}

        {/* Capability Chips */}
        <div className={cn('flex flex-wrap gap-1.5', dim)}>
          {meta.capabilities.map((capKey) => (
            <span
              key={capKey}
              className='bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-medium'
            >
              {t(capKey)}
            </span>
          ))}
        </div>

        {/* Text-only 24h Metrics (interval-colored success rate + exact seconds duration) & Groups */}
        {!maintenance && (
          <div className='flex flex-col gap-2'>
            <div
              aria-label={t('Performance metrics for the last 24 hours')}
              className='text-subtle-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]'
            >
              <span>
                {t('24h success rate')}{' '}
                <MarketSuccessRate
                  perf={activePerf}
                  className='font-semibold'
                />
              </span>
              <span aria-hidden className='opacity-40'>
                ·
              </span>
              <span>
                {t('Avg duration')}{' '}
                <b className='text-foreground font-mono font-medium tabular-nums'>
                  {formatExactSeconds(activePerf?.latencyMs)}
                </b>
              </span>
            </div>
            {groups.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5'>
                <small className='text-subtle-foreground mr-0.5 text-[11px]'>
                  {t('Group')}
                </small>
                <MarketGroupTags
                  groups={groups}
                  max={4}
                  className='text-[11px]'
                />
              </div>
            )}
          </div>
        )}

        {/* Footer: Pricing + Studio CTA */}
        <div
          role='group'
          aria-label={t('Pricing')}
          className='mt-auto flex flex-wrap items-end justify-between gap-2 border-t pt-3'
        >
          <div className={cn('min-w-0', dim)}>
            <div className='flex flex-wrap items-baseline gap-1.5'>
              <b className='font-mono text-[18px] leading-none font-bold tabular-nums'>
                {primaryPrice?.value ?? '—'}
              </b>
              {primaryPrice?.unit && (
                <span className='text-subtle-foreground text-[11.5px]'>
                  {primaryPrice.unit}
                </span>
              )}
              {perSecondPrice && (
                <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums'>
                  ≈ {perSecondPrice}/{t('sec short')}
                </span>
              )}
            </div>
            <div className='text-subtle-foreground mt-1 text-[11px]'>
              {t('Up to {{seconds}}s · Auto-refund on failure', {
                seconds: activeTier.durationSec,
              })}
            </div>
          </div>

          {maintenance ? (
            <button
              type='button'
              disabled
              className='bg-card text-subtle-foreground inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 text-xs opacity-60'
            >
              <Wrench aria-hidden className='size-3.5' strokeWidth={1.8} />
              {t('Under maintenance')}
            </button>
          ) : (
            <button
              type='button'
              onClick={() =>
                props.onOpenStudio
                  ? props.onOpenStudio(activeModel.model_name, 'video')
                  : props.onClick(activeModel.model_name)
              }
              className='inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90'
              style={{ backgroundColor: accent }}
            >
              <Sparkles aria-hidden className='size-3.5' strokeWidth={2.1} />
              {t('Create video')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
})

export interface VideoSingleCardProps {
  model: PricingModel
  perf?: MarketPerf
  onClick: (modelName: string) => void
  onOpenStudio?: (modelName: string, kind: 'video' | 'image') => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

export const VideoSingleCard = memo(function VideoSingleCard(
  props: VideoSingleCardProps
) {
  const { t } = useTranslation()
  const model = props.model
  const durationSec = parseVideoDurationSeconds(model.model_name)
  const title = getVideoDisplayTitle(model)
  const meta = useMemo(() => parseVideoMetadata(model), [model])
  const accent = resolveVideoAccent(model)
  const groups = filterValidGroups(model)
  const maintenance = model.maintenance
  const dim = maintenance ? MAINTENANCE_DIM_CLASS : undefined

  const prices = useMarketPrice(model, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  const primaryPrice =
    model.quota_type === QUOTA_TYPE_VALUES.REQUEST
      ? (prices.find((p) => p.key === 'price') ?? prices[0])
      : prices[0]

  const perSecondPrice = durationSec
    ? formatRequestPricePerUnit(
        model,
        durationSec,
        props.showRechargePrice ?? false,
        props.priceRate ?? 1,
        props.usdExchangeRate ?? 1,
        props.selectedGroup,
        true,
        2
      )
    : undefined

  return (
    <article
      aria-label={model.model_name}
      className={cn(
        'group/market bg-card hover:shadow-card relative flex min-w-0 flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-150',
        maintenance ? 'border-indigo-500/35' : 'hover:border-(--family)/45'
      )}
      style={
        {
          '--family': accent,
          ...(maintenance && { backgroundImage: MAINTENANCE_STRIPES }),
        } as CSSProperties
      }
    >
      {/* Compact Cinema Header */}
      <div
        className={cn('relative overflow-hidden px-4 pt-3.5 pb-3 text-white', dim)}
        style={cinemaBackdropStyle(accent)}
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0'
          style={CINEMA_GRID_STYLE}
        />
        <div className='relative z-10 flex items-start justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span
              aria-hidden
              className='grid size-9 shrink-0 place-items-center rounded-[9px] border border-white/15 bg-white/10'
            >
              <Film className='size-4' style={{ color: accent }} />
            </span>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-1.5'>
                <strong className='text-[15.5px] leading-tight font-bold tracking-[-0.01em]'>
                  {title}
                </strong>
                {durationSec && (
                  <span
                    className='rounded px-1.5 py-0.5 font-mono text-[10.5px] leading-none font-bold text-white tabular-nums'
                    style={{ backgroundColor: accent }}
                  >
                    {durationSec}s
                  </span>
                )}
              </div>
              <div className='mt-0.5 flex items-center gap-1'>
                <span
                  title={model.model_name}
                  className='truncate font-mono text-[11px] text-white/75'
                >
                  {model.model_name}
                </span>
                <CopyButton
                  value={model.model_name}
                  aria-label={t('Copy model name')}
                  className='size-4 rounded text-white/70 opacity-65 transition-opacity group-hover/market:opacity-100 hover:text-white focus-visible:opacity-100'
                  iconClassName='size-3'
                />
              </div>
            </div>
          </div>
          <button
            type='button'
            aria-label={t('Details')}
            title={t('Details')}
            onClick={() => props.onClick(model.model_name)}
            className='-my-1 -mr-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white'
          >
            <ChevronRight aria-hidden className='size-4' strokeWidth={1.9} />
          </button>
        </div>

        <div className='relative z-10 mt-2.5 flex items-center justify-between gap-2 text-[11px] text-white/80'>
          <span className='truncate'>
            {[meta.specLine, meta.hasAudio ? t('Native audio') : '']
              .filter(Boolean)
              .join(' · ') || t('Video generation')}
          </span>
          <span className='shrink-0 font-mono text-[10.5px] text-white/85'>
            MP4
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className='flex flex-1 flex-col gap-3 p-4'>
        {maintenance && (
          <VideoMaintenanceRibbon
            note={maintenance.note}
            until={maintenance.until}
          />
        )}

        <div className={cn('flex flex-wrap gap-1.5', dim)}>
          {meta.capabilities.slice(0, 3).map((capKey) => (
            <span
              key={capKey}
              className='bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-medium'
            >
              {t(capKey)}
            </span>
          ))}
        </div>

        {!maintenance && (
          <div
            aria-label={t('Performance metrics for the last 24 hours')}
            className='text-subtle-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]'
          >
            <span>
              {t('Success rate')}{' '}
              <MarketSuccessRate perf={props.perf} className='font-semibold' />
            </span>
            <span aria-hidden className='opacity-40'>
              ·
            </span>
            <span>
              {t('Avg duration')}{' '}
              <b className='text-foreground font-mono font-medium tabular-nums'>
                {formatExactSeconds(props.perf?.latencyMs)}
              </b>
            </span>
          </div>
        )}

        {groups.length > 0 && (
          <div className={cn('flex flex-wrap items-center gap-1.5', dim)}>
            <small className='text-subtle-foreground mr-0.5 text-[11px]'>
              {t('Group')}
            </small>
            <MarketGroupTags groups={groups} max={4} className='text-[11px]' />
          </div>
        )}

        <div
          role='group'
          aria-label={t('Pricing')}
          className='mt-auto flex items-end justify-between gap-2 border-t pt-3'
        >
          <div className={cn('min-w-0', dim)}>
            <div className='flex items-baseline gap-1'>
              <b className='truncate font-mono text-[16px] leading-none font-bold tabular-nums'>
                {primaryPrice?.value ?? '—'}
              </b>
              {primaryPrice?.unit && (
                <span className='text-subtle-foreground text-[11px]'>
                  {primaryPrice.unit}
                </span>
              )}
            </div>
            {perSecondPrice ? (
              <div className='text-subtle-foreground mt-1 font-mono text-[10.5px] tabular-nums'>
                ≈ {perSecondPrice} / {t('sec short')}
              </div>
            ) : (
              primaryPrice?.label && (
                <div className='text-subtle-foreground mt-1 text-[10.5px]'>
                  {primaryPrice.label}
                </div>
              )
            )}
          </div>

          {maintenance ? (
            <button
              type='button'
              disabled
              className='bg-card text-subtle-foreground inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg border px-2.5 text-xs opacity-60'
            >
              <Wrench aria-hidden className='size-3.5' strokeWidth={1.8} />
              {t('Under maintenance')}
            </button>
          ) : (
            <button
              type='button'
              onClick={() =>
                props.onOpenStudio
                  ? props.onOpenStudio(model.model_name, 'video')
                  : props.onClick(model.model_name)
              }
              className='inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'
              style={{ backgroundColor: accent }}
            >
              {t('Create video')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
})

const IMAGE_ACCENT = '#A855F7'

export interface ImageModelCardProps {
  model: PricingModel
  perf?: MarketPerf
  onClick: (modelName: string) => void
  onOpenStudio?: (modelName: string, kind: 'video' | 'image') => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

export const ImageModelCard = memo(function ImageModelCard(
  props: ImageModelCardProps
) {
  const { t } = useTranslation()
  const model = props.model
  const title = getImageDisplayTitle(model)
  const meta = useMemo(() => parseImageMetadata(model), [model])
  const groups = filterValidGroups(model)
  const maintenance = model.maintenance
  const dim = maintenance ? MAINTENANCE_DIM_CLASS : undefined

  const prices = useMarketPrice(model, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  const isFixed = model.quota_type === QUOTA_TYPE_VALUES.REQUEST
  const primaryPrice = isFixed
    ? (prices.find((p) => p.key === 'price') ?? prices[0])
    : prices[0]

  const specSummary =
    [
      meta.nativeResolution ? t('Native resolution') : '',
      meta.resolution ?? '',
    ]
      .filter(Boolean)
      .join(' · ') || t('Image generation')

  return (
    <article
      aria-label={model.model_name}
      className={cn(
        'group/market bg-card hover:shadow-card relative flex min-w-0 flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-150',
        maintenance ? 'border-indigo-500/35' : 'hover:border-(--family)/45'
      )}
      style={
        {
          '--family': IMAGE_ACCENT,
          ...(maintenance && { backgroundImage: MAINTENANCE_STRIPES }),
        } as CSSProperties
      }
    >
      {/* Purple Media Header (Unified visual family with Video card) */}
      <div
        className={cn('relative overflow-hidden px-4 pt-3.5 pb-3 text-white', dim)}
        style={imageBackdropStyle(IMAGE_ACCENT)}
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0'
          style={CINEMA_GRID_STYLE}
        />
        <div className='relative z-10 flex items-start justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span
              aria-hidden
              className='grid size-9 shrink-0 place-items-center rounded-[9px] border border-white/15 bg-white/10 text-purple-300'
            >
              <ImageIcon className='size-4' />
            </span>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-1.5'>
                <strong className='text-[15.5px] leading-tight font-bold tracking-[-0.01em]'>
                  {title}
                </strong>
                <span className='rounded bg-purple-500/85 px-1.5 py-0.5 text-[10.5px] leading-none font-semibold text-white'>
                  {t('Image')}
                </span>
              </div>
              <div className='mt-0.5 flex items-center gap-1'>
                <span
                  title={model.model_name}
                  className='truncate font-mono text-[11px] text-white/75'
                >
                  {model.model_name}
                </span>
                <CopyButton
                  value={model.model_name}
                  aria-label={t('Copy model name')}
                  className='size-4 rounded text-white/70 opacity-65 transition-opacity group-hover/market:opacity-100 hover:text-white focus-visible:opacity-100'
                  iconClassName='size-3'
                />
              </div>
            </div>
          </div>
          <button
            type='button'
            aria-label={t('Details')}
            title={t('Details')}
            onClick={() => props.onClick(model.model_name)}
            className='-my-1 -mr-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white'
          >
            <ChevronRight aria-hidden className='size-4' strokeWidth={1.9} />
          </button>
        </div>

        <div className='relative z-10 mt-2.5 flex items-center justify-between gap-2 text-[11px] text-white/80'>
          <span className='truncate'>{specSummary}</span>
          <span className='shrink-0 font-mono text-[10.5px] text-white/85'>
            {meta.formatLabel}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className='flex flex-1 flex-col gap-3 p-4'>
        {maintenance && (
          <VideoMaintenanceRibbon
            note={maintenance.note}
            until={maintenance.until}
          />
        )}

        <div className={cn('flex flex-wrap gap-1.5', dim)}>
          {meta.capabilities.map((capKey) => (
            <span
              key={capKey}
              className='bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-medium'
            >
              {t(capKey)}
            </span>
          ))}
        </div>

        {!maintenance && (
          <div
            aria-label={t('Performance metrics for the last 24 hours')}
            className='text-subtle-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]'
          >
            <span>
              {t('Success rate')}{' '}
              <MarketSuccessRate perf={props.perf} className='font-semibold' />
            </span>
            <span aria-hidden className='opacity-40'>
              ·
            </span>
            <span>
              {t('Avg duration')}{' '}
              <b className='text-foreground font-mono font-medium tabular-nums'>
                {formatExactSeconds(props.perf?.latencyMs)}
              </b>
            </span>
          </div>
        )}

        {groups.length > 0 && (
          <div className={cn('flex flex-wrap items-center gap-1.5', dim)}>
            <small className='text-subtle-foreground mr-0.5 text-[11px]'>
              {t('Group')}
            </small>
            <MarketGroupTags groups={groups} max={4} className='text-[11px]' />
          </div>
        )}

        <div
          role='group'
          aria-label={t('Pricing')}
          className='mt-auto flex items-end justify-between gap-2 border-t pt-3'
        >
          <div className={cn('min-w-0', dim)}>
            <div className='flex items-baseline gap-1'>
              <b className='truncate font-mono text-[16px] leading-none font-bold tabular-nums'>
                {primaryPrice?.value ?? '—'}
              </b>
              <span className='text-subtle-foreground text-[11px]'>
                {isFixed
                  ? `/ ${t('image unit')}`
                  : (primaryPrice?.unit ?? '')}
              </span>
            </div>
            <div className='text-subtle-foreground mt-1 text-[10.5px]'>
              {isFixed
                ? t('Per request · Native image')
                : (primaryPrice?.label ?? t('Per image'))}
            </div>
          </div>

          {maintenance ? (
            <button
              type='button'
              disabled
              className='bg-card text-subtle-foreground inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg border px-2.5 text-xs opacity-60'
            >
              <Wrench aria-hidden className='size-3.5' strokeWidth={1.8} />
              {t('Under maintenance')}
            </button>
          ) : (
            <button
              type='button'
              onClick={() =>
                props.onOpenStudio
                  ? props.onOpenStudio(model.model_name, 'image')
                  : props.onClick(model.model_name)
              }
              className='inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'
              style={{ backgroundColor: IMAGE_ACCENT }}
            >
              {t('Create image')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
})

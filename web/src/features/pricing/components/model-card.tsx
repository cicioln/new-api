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
import { Clock, Wrench } from 'lucide-react'
import { memo, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  formatMarketLatency,
  formatMarketTps,
  getVendorAvatarIcon,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import { getFamilyColor, parseModelName } from '../lib/model-name'
import type { PricingModel, TokenUnit } from '../types'
import {
  MarketDetailsButton,
  MarketGroupTags,
  MarketModelName,
  PelicanButton,
  VendorAvatar,
} from './market-parts'
import { MarketStatusBars, MarketSuccessRate } from './market-status'

// Muted content of a card whose channels are all under maintenance.
const MAINTENANCE_DIM_CLASS = 'opacity-50 grayscale'
const MAINTENANCE_STRIPES =
  'repeating-linear-gradient(135deg, transparent 0 10px, rgb(99 102 241 / 0.04) 10px 20px)'

/** Expected recovery as "today 18:00" or "10-30 09:00". */
function useMaintenanceRecovery(until: number | undefined): string {
  const { t } = useTranslation()
  if (!until) return t('Recovery time to be determined')
  const time = dayjs.unix(until)
  const text = time.isSame(dayjs(), 'day')
    ? t('Today {{time}}', { time: time.format('HH:mm') })
    : time.format('MM-DD HH:mm')
  return t('Expected recovery {{time}}', { time: text })
}

function MaintenanceRibbon(props: { note?: string; until?: number }) {
  const { t } = useTranslation()
  const recovery = useMaintenanceRecovery(props.until)
  return (
    <div
      role='status'
      className='flex items-start gap-2 rounded-[9px] bg-indigo-500/10 px-2.5 py-2 text-xs text-indigo-600 dark:text-indigo-400'
    >
      <Clock aria-hidden className='mt-0.5 size-3.5 shrink-0' strokeWidth={2.2} />
      <div className='min-w-0'>
        <b className='block font-semibold break-words'>
          {props.note || t('Under maintenance, service paused')}
        </b>
        <div className='text-[11.5px] opacity-80'>{recovery}</div>
      </div>
    </div>
  )
}

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  onTest?: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: MarketPerf
  /** Newest version of its family in the current list. */
  latest?: boolean
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const prices = useMarketPrice(props.model, {
    tokenUnit: props.tokenUnit ?? DEFAULT_TOKEN_UNIT,
    showRechargePrice: props.showRechargePrice ?? false,
    priceRate: props.priceRate ?? 1,
    usdExchangeRate: props.usdExchangeRate ?? 1,
    group: props.selectedGroup,
  })
  // Hide groups that were removed from group pricing.
  const groups = (props.model.enable_groups || []).filter(
    (group) =>
      !props.model.group_ratio || Object.hasOwn(props.model.group_ratio, group)
  )
  const parsed = useMemo(
    () => parseModelName(props.model.model_name),
    [props.model.model_name]
  )
  // Each model family gets its own accent, so Opus / Sonnet / Haiku cards of
  // the same vendor still look different at a glance.
  const familyColor = getFamilyColor(parsed)
  const maintenance = props.model.maintenance
  const dim = maintenance ? MAINTENANCE_DIM_CLASS : undefined
  return (
    // Only the Details button opens the side panel, so the card itself is a
    // plain region with a default cursor and text selection.
    <article
      aria-label={props.model.model_name}
      className={cn(
        'group/market bg-card hover:shadow-card relative flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-[border-color,box-shadow] duration-150',
        maintenance ? 'border-indigo-500/35' : 'hover:border-(--family)/45'
      )}
      style={
        {
          '--family': familyColor,
          ...(maintenance && { backgroundImage: MAINTENANCE_STRIPES }),
        } as CSSProperties
      }
    >
      <div className='flex items-center gap-3'>
        <span
          aria-hidden
          className={cn(
            'grid size-[46px] shrink-0 place-items-center rounded-[10px] bg-(--family)/12',
            dim
          )}
        >
          <VendorAvatar
            name={getVendorAvatarName(props.model)}
            icon={getVendorAvatarIcon(props.model)}
          />
        </span>
        <div className={cn('min-w-0 flex-1', dim)}>
          <div className='flex flex-wrap items-baseline gap-x-2 text-[19px] leading-tight tracking-[-0.01em]'>
            <strong className='font-bold break-all'>{parsed.label}</strong>
            {parsed.version && (
              <span className='font-medium text-(--family) tabular-nums'>
                {parsed.version}
              </span>
            )}
          </div>
          {(props.latest || parsed.tags.length > 0) && (
            <div className='mt-1 flex flex-wrap gap-1'>
              {props.latest && (
                <span className='inline-flex h-5 items-center rounded-full bg-(--family)/12 px-2 text-[11px] font-medium text-(--family)'>
                  {t('Latest')}
                </span>
              )}
              {parsed.tags.map((tag) => (
                <span
                  key={tag}
                  className='text-muted-foreground inline-flex h-5 items-center rounded-full border px-2 text-[11px]'
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {maintenance && (
          <span className='inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-indigo-500/12 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400'>
            <Wrench aria-hidden className='size-3' strokeWidth={2.4} />
            {t('Under maintenance')}
          </span>
        )}
        <MarketDetailsButton
          modelName={props.model.model_name}
          onClick={props.onClick}
        />
      </div>

      <MarketModelName
        name={props.model.model_name}
        className={cn('text-subtle-foreground text-[11.5px] font-normal', dim)}
      />

      {maintenance && (
        <MaintenanceRibbon note={maintenance.note} until={maintenance.until} />
      )}

      {groups.length > 0 && (
        <div className={cn('flex flex-wrap items-center gap-1.5', dim)}>
          <small className='text-subtle-foreground mr-0.5 text-[11px]'>
            {t('Group')}
          </small>
          <MarketGroupTags groups={groups} max={4} className='text-[11px]' />
        </div>
      )}

      {maintenance ? null : props.perf ? (
        <div
          aria-label={t('Performance metrics for the last 24 hours')}
          className='text-subtle-foreground flex flex-col gap-1.5 text-[11.5px]'
        >
          <div className='flex flex-wrap items-center gap-x-3.5 gap-y-1 whitespace-nowrap'>
            <span>
              {t('Status')}{' '}
              <MarketSuccessRate perf={props.perf} className='font-medium' />
            </span>
            <span>
              {t('Latency')}{' '}
              <b className='text-foreground font-mono font-medium'>
                {formatMarketLatency(props.perf?.latencyMs)}
              </b>
            </span>
            <span>
              {t('Throughput short')}{' '}
              <b className='text-foreground font-mono font-medium'>
                {formatMarketTps(props.perf?.tps)}
                {props.perf?.tps != null && (
                  <span className='text-subtle-foreground font-normal'>
                    {' '}
                    t/s
                  </span>
                )}
              </b>
            </span>
          </div>
          <MarketStatusBars perf={props.perf} className='h-2.5' />
        </div>
      ) : (
        <div
          aria-label={t('Performance metrics for the last 24 hours')}
          className='text-subtle-foreground text-[11.5px]'
        >
          {t('No performance data available')}
        </div>
      )}

      <div
        role='group'
        aria-label={t('Pricing')}
        className='mt-auto grid grid-cols-[1fr_1fr_auto] items-end border-t pt-3'
      >
        {prices.map((price, index) => (
          <div key={price.key} className={cn('min-w-0', dim)}>
            <small className='text-subtle-foreground block truncate text-[11.5px]'>
              {price.label}
            </small>
            {/* The first price (usually input) leads; the rest stay quieter. */}
            <b
              className={cn(
                'block truncate font-mono',
                index === 0
                  ? 'text-[15px] font-semibold'
                  : 'text-muted-foreground text-sm font-medium'
              )}
            >
              {price.value}
              {price.unit && (
                <span className='text-subtle-foreground text-[11.5px] font-normal'>
                  {' '}
                  {price.unit}
                </span>
              )}
            </b>
          </div>
        ))}
        {prices.length < 2 && <div />}
        {props.onTest && (
          <PelicanButton model={props.model} onTest={props.onTest} />
        )}
      </div>
    </article>
  )
})

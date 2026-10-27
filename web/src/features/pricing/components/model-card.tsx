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
import { memo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  formatMarketLatency,
  formatMarketTps,
  getVendorAvatar,
  getVendorAvatarIcon,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import type { PricingModel, TokenUnit } from '../types'
import {
  MarketDetailsButton,
  MarketGroupTags,
  MarketModelName,
  PelicanButton,
  VendorAvatar,
} from './market-parts'
import { MarketStatusBars, MarketSuccessRate } from './market-status'

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
  const vendorName = getVendorAvatarName(props.model)
  // A faint wash of the vendor color at the top tells cards apart at a glance.
  const vendorColor = getVendorAvatar(vendorName).color
  return (
    // Only the Details button opens the side panel, so the card itself is a
    // plain region with a default cursor and text selection.
    <article
      aria-label={props.model.model_name}
      className='group/market bg-card hover:shadow-card relative flex min-w-0 flex-col gap-3 rounded-xl border bg-no-repeat p-[18px] transition-[border-color,box-shadow] duration-150 hover:border-(--vendor)/45'
      style={
        {
          '--vendor': vendorColor,
          backgroundImage: `linear-gradient(180deg, color-mix(in oklab, ${vendorColor} 9%, transparent), transparent 88px)`,
        } as CSSProperties
      }
    >
      <div className='flex items-start gap-3'>
        <VendorAvatar
          name={vendorName}
          icon={getVendorAvatarIcon(props.model)}
        />
        <div className='min-w-0 flex-1'>
          <MarketModelName
            name={props.model.model_name}
            className='text-[14.5px] leading-[22px]'
            wrap
          />
          <small className='text-subtle-foreground block truncate text-xs'>
            {props.model.vendor_name || '—'}
          </small>
        </div>
        <MarketDetailsButton
          modelName={props.model.model_name}
          onClick={props.onClick}
        />
      </div>

      {groups.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <small className='text-subtle-foreground mr-0.5 text-[11.5px]'>
            {t('Group')}
          </small>
          <MarketGroupTags groups={groups} max={4} className='text-[11.5px]' />
        </div>
      )}

      {props.perf ? (
        <div
          aria-label={t('Performance metrics for the last 24 hours')}
          className='bg-muted grid grid-cols-[1.6fr_1fr_1fr] rounded-lg px-3 py-2.5'
        >
          <div className='min-w-0'>
            <small className='text-subtle-foreground flex justify-between pr-3 text-[11px] whitespace-nowrap'>
              {t('Status')}
              <MarketSuccessRate perf={props.perf} />
            </small>
            <MarketStatusBars perf={props.perf} className='mt-[5px] pr-3' />
          </div>
          <div className='min-w-0 border-l pl-3'>
            <small className='text-subtle-foreground block text-[11px] whitespace-nowrap'>
              {t('Latency')}
            </small>
            <b className='font-mono text-[13px] font-medium whitespace-nowrap'>
              {formatMarketLatency(props.perf?.latencyMs)}
            </b>
          </div>
          <div className='min-w-0 border-l pl-3'>
            <small className='text-subtle-foreground block text-[11px] whitespace-nowrap'>
              {t('Throughput short')}
            </small>
            <b className='font-mono text-[13px] font-medium whitespace-nowrap'>
              {formatMarketTps(props.perf?.tps)}
              {props.perf?.tps != null && (
                <span className='text-subtle-foreground text-[11px] font-normal'>
                  {' '}
                  t/s
                </span>
              )}
            </b>
          </div>
        </div>
      ) : (
        <div
          aria-label={t('Performance metrics for the last 24 hours')}
          className='text-subtle-foreground rounded-lg border border-dashed px-3 py-2 text-center text-[11.5px]'
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
          <div key={price.key} className='min-w-0'>
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

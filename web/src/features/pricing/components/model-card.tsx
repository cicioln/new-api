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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useMarketPrice } from '../hooks/use-market-price'
import {
  formatMarketLatency,
  formatMarketTps,
  getVendorAvatarIcon,
  getVendorAvatarName,
  type MarketPerf,
} from '../lib/market'
import type { PricingModel, TokenUnit } from '../types'
import {
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
  const open = () => props.onClick(props.model.model_name)

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={props.model.model_name}
      onClick={open}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      className='group/market bg-card hover:border-input hover:shadow-card relative flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border p-[18px] transition-all duration-150 hover:-translate-y-px'
    >
      <div className='flex items-center gap-3'>
        <VendorAvatar
          name={getVendorAvatarName(props.model)}
          icon={getVendorAvatarIcon(props.model)}
        />
        <div className='min-w-0 flex-1'>
          <MarketModelName
            name={props.model.model_name}
            className='text-[14.5px]'
          />
          <small className='text-subtle-foreground block truncate text-xs'>
            {props.model.vendor_name || '—'}
          </small>
        </div>
      </div>

      {groups.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <small className='text-subtle-foreground mr-0.5 text-[11.5px]'>
            {t('Group')}
          </small>
          <MarketGroupTags groups={groups} max={4} className='text-[11.5px]' />
        </div>
      )}

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

      <div
        role='group'
        aria-label={t('Pricing')}
        className='mt-auto grid grid-cols-[1fr_1fr_auto] items-end border-t pt-3'
      >
        {prices.map((price) => (
          <div key={price.key} className='min-w-0'>
            <small className='text-subtle-foreground block truncate text-[11.5px]'>
              {price.label}
            </small>
            <b className='block truncate font-mono text-sm font-medium'>
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
    </div>
  )
})

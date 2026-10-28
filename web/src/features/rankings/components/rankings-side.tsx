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
import { useTranslation } from 'react-i18next'

import { VendorAvatar } from '@/features/pricing/components/market-parts'
import { getVendorAvatar } from '@/features/pricing/lib/market'

import { formatShare } from '../lib/format'
import { getTopRisers } from '../lib/rankings'
import type { RankingMover, VendorRanking } from '../types'
import { RankingModelName } from './ranking-model-name'

const DONUT_RADIUS = 42
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

/** Ring chart of vendor share with the leader's share in the middle. */
function VendorDonut(props: { vendors: VendorRanking[]; label: string }) {
  let offset = 0
  return (
    <svg
      role='img'
      aria-label={props.label}
      width='110'
      height='110'
      viewBox='0 0 110 110'
      className='shrink-0'
    >
      <circle
        r={DONUT_RADIUS}
        cx='55'
        cy='55'
        fill='none'
        strokeWidth='16'
        className='stroke-muted'
      />
      {props.vendors.map((vendor) => {
        const length = vendor.share * DONUT_CIRCUMFERENCE
        const dashOffset = -offset
        offset += length
        return (
          <circle
            key={vendor.vendor}
            r={DONUT_RADIUS}
            cx='55'
            cy='55'
            fill='none'
            strokeWidth='16'
            stroke={getVendorAvatar(vendor.vendor).color}
            strokeDasharray={`${Math.max(length - 2, 0)} ${DONUT_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            transform='rotate(-90 55 55)'
          />
        )
      })}
      <text
        x='55'
        y='52'
        textAnchor='middle'
        className='fill-muted-foreground text-[11px]'
      >
        Top
      </text>
      <text
        x='55'
        y='68'
        textAnchor='middle'
        className='fill-foreground font-mono text-sm font-bold'
      >
        {formatShare(props.vendors[0]?.share ?? 0)}
      </text>
    </svg>
  )
}

export function VendorShareCard(props: { vendors: VendorRanking[] }) {
  const { t } = useTranslation()
  return (
    <section className='bg-card rounded-[14px] border p-[18px]'>
      <h2 className='text-sm font-semibold'>{t('Vendor share')}</h2>
      <p className='text-subtle-foreground mt-0.5 text-[12.5px]'>
        {t('Token share')}
      </p>
      {props.vendors.length === 0 ? (
        <p className='text-subtle-foreground mt-2 text-[12.5px]'>
          {t('No data')}
        </p>
      ) : (
        <div className='mt-3.5 flex items-center gap-[18px]'>
          <VendorDonut vendors={props.vendors} label={t('Vendor share')} />
          <ul className='grid min-w-0 flex-1 gap-2 text-[13px]'>
            {props.vendors.map((vendor) => (
              <li
                key={vendor.vendor}
                className='flex min-w-0 items-center gap-2'
              >
                <i
                  aria-hidden
                  className='size-[9px] shrink-0 rounded-[3px]'
                  style={{ background: getVendorAvatar(vendor.vendor).color }}
                />
                <span className='truncate'>{vendor.vendor}</span>
                <small className='text-subtle-foreground ml-auto font-mono text-xs'>
                  {formatShare(vendor.share)}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export function TopRisersCard(props: { movers: RankingMover[] }) {
  const { t } = useTranslation()
  const risers = getTopRisers(props.movers)
  return (
    <section className='bg-card rounded-[14px] border p-[18px]'>
      <h2 className='text-sm font-semibold'>{t('Fastest rising')}</h2>
      <p className='text-subtle-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t('Rank improvement versus the previous period')}
      </p>
      {risers.length === 0 ? (
        <p className='text-subtle-foreground text-[13px]'>{t('No data')}</p>
      ) : (
        <ul className='grid gap-3'>
          {risers.map((row) => (
            <li
              key={row.model_name}
              className='flex items-center gap-2.5 text-[13px]'
            >
              <VendorAvatar
                name={row.vendor}
                icon={row.vendor_icon}
                className='size-[26px] rounded-[7px] text-[11px]'
              />
              <RankingModelName
                modelName={row.model_name}
                className='flex-1 flex-nowrap overflow-hidden'
              />
              <span className='text-success font-mono text-xs'>
                ▲ {row.rank_delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

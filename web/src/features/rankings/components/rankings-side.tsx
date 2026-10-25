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

export function VendorShareCard(props: { vendors: VendorRanking[] }) {
  const { t } = useTranslation()
  return (
    <section className='bg-card rounded-xl border p-[18px]'>
      <h2 className='text-sm font-semibold'>{t('Vendor share')}</h2>
      {props.vendors.length === 0 ? (
        <p className='text-subtle-foreground mt-2 text-[12.5px]'>
          {t('No data')}
        </p>
      ) : (
        <>
          <div
            role='img'
            aria-label={t('Vendor share')}
            className='mt-1 mb-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-md'
          >
            {props.vendors.map((vendor) => (
              <i
                key={vendor.vendor}
                className='block'
                style={{
                  width: `${vendor.share * 100}%`,
                  background: getVendorAvatar(vendor.vendor).color,
                }}
              />
            ))}
          </div>
          <ul className='grid gap-2.5 text-[13px]'>
            {props.vendors.map((vendor) => (
              <li key={vendor.vendor} className='flex items-center gap-2'>
                <i
                  aria-hidden
                  className='size-2 shrink-0 rounded-[2px]'
                  style={{ background: getVendorAvatar(vendor.vendor).color }}
                />
                {vendor.vendor}
                <small className='text-subtle-foreground ml-auto font-mono text-xs'>
                  {formatShare(vendor.share)}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function TopRisersCard(props: { movers: RankingMover[] }) {
  const { t } = useTranslation()
  const risers = getTopRisers(props.movers)
  return (
    <section className='bg-card rounded-xl border p-[18px]'>
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
                className='size-6 rounded-md text-[11px]'
              />
              <b className='min-w-0 flex-1 truncate font-mono text-[12.5px] font-medium'>
                {row.model_name}
              </b>
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

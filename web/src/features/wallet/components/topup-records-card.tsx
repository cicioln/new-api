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

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatCurrencyFromUSD,
  formatLocalCurrencyAmount,
} from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { useBillingHistory } from '../hooks/use-billing-history'
import { formatTimestamp, getPaymentMethodName } from '../lib/billing'

const RECENT_TOPUP_LIMIT = 5
const SKELETON_ROWS = ['a', 'b', 'c']
const AMOUNT_FORMAT = {
  digitsLarge: 2,
  digitsSmall: 2,
  abbreviate: false,
  minimumFractionDigits: 2,
}

/** The latest top-up orders inline on the wallet page; the full list stays in the history dialog. */
export function TopupRecordsCard(props: { onOpenAll: () => void }) {
  const { t } = useTranslation()
  const history = useBillingHistory({
    initialPageSize: RECENT_TOPUP_LIMIT,
    selfOnly: true,
  })

  return (
    <section className='bg-card overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4 pb-3'>
        <h3 className='text-sm font-semibold'>{t('Top-up records')}</h3>
        {history.total > RECENT_TOPUP_LIMIT && (
          <Button
            variant='link'
            size='sm'
            className='text-muted-foreground h-auto p-0 text-xs'
            onClick={props.onOpenAll}
          >
            {t('View all')} →
          </Button>
        )}
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full border-collapse text-[13px]'>
          <thead>
            <tr className='bg-background text-muted-foreground border-y text-left text-xs [&>th]:px-[18px] [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap'>
              <th>{t('Time')}</th>
              <th>{t('Order No.')}</th>
              <th>{t('Top-up method')}</th>
              <th className='text-right'>{t('Paid')}</th>
              <th className='text-right'>{t('Credited')}</th>
              <th>{t('Status')}</th>
            </tr>
          </thead>
          <tbody className='[&_td]:px-[18px] [&_td]:py-[11px] [&_td]:whitespace-nowrap [&>tr]:border-b [&>tr:last-child]:border-0'>
            {history.loading &&
              history.records.length === 0 &&
              SKELETON_ROWS.map((key) => (
                <tr key={key}>
                  <td colSpan={6}>
                    <Skeleton className='h-4 w-full' />
                  </td>
                </tr>
              ))}
            {!history.loading && history.records.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  {t('No top-up records yet')}
                </td>
              </tr>
            )}
            {history.records.map((record) => {
              const isCredited = record.status === 'success'
              return (
                <tr
                  key={record.id}
                  className='hover:bg-muted/50 transition-colors'
                >
                  <td
                    className='text-muted-foreground font-mono text-xs'
                    title={formatTimestamp(record.create_time)}
                  >
                    {dayjs.unix(record.create_time).format('MM-DD HH:mm')}
                  </td>
                  <td className='font-mono text-xs'>{record.trade_no}</td>
                  <td>{getPaymentMethodName(record.payment_method, t)}</td>
                  <td className='text-right font-mono text-[12.5px] tabular-nums'>
                    {formatLocalCurrencyAmount(record.money, AMOUNT_FORMAT)}
                  </td>
                  <td className='text-right font-mono text-[12.5px] tabular-nums'>
                    {record.amount
                      ? formatCurrencyFromUSD(record.amount, AMOUNT_FORMAT)
                      : '—'}
                  </td>
                  <td>
                    <span
                      className={cn(
                        'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap',
                        isCredited
                          ? 'bg-success/12 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <span
                        aria-hidden
                        className='size-1.5 rounded-full bg-current'
                      />
                      {isCredited ? t('Top-up credited') : t('Order closed')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

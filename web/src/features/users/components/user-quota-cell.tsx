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

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

type UserQuotaCellProps = {
  remaining: number
  used: number
}

// Share of the total grant (used + remaining) that has been consumed.
function getUsedPercent(remaining: number, used: number) {
  const total = Math.max(remaining, 0) + Math.max(used, 0)
  if (total <= 0) return 0
  return Math.min(100, Math.round((Math.max(used, 0) / total) * 100))
}

export function UserQuotaCell(props: UserQuotaCellProps) {
  const { t } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)

  const { meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol
  const formattedRemaining = formatQuotaWithCurrency(props.remaining, {
    showSymbol: false,
  })
  const formattedUsed = formatQuotaWithCurrency(props.used, {
    showSymbol: false,
  })
  const percent = getUsedPercent(props.remaining, props.used)

  return (
    <QuotaDetailsPopover
      title={`${t('Quota')} (${quotaUnit})`}
      triggerLabel={`${t('Used percentage')} ${percent}%`}
      details={[
        { label: t('Available Balance'), value: formattedRemaining },
        { label: t('Total Used'), value: formattedUsed },
      ]}
    >
      <span className='flex w-full min-w-[120px] items-center gap-2'>
        <span
          role='progressbar'
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('Used percentage')}
          className='bg-muted h-1 flex-1 overflow-hidden rounded-full'
        >
          <span
            className={cn(
              'block h-full rounded-full',
              percent > 90 ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${percent}%` }}
          />
        </span>
        <small className='text-subtle-foreground font-mono! text-[11.5px]! tabular-nums'>
          {percent}%
        </small>
      </span>
    </QuotaDetailsPopover>
  )
}

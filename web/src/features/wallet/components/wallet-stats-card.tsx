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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
  onTransfer?: () => void
  transferDisabled?: boolean
}

function StatCard(props: {
  label: string
  value: string
  detail: ReactNode
  loading?: boolean
}) {
  return (
    <div className='bg-card min-w-0 rounded-lg border p-[18px]'>
      <small className='text-muted-foreground text-[12.5px]'>
        {props.label}
      </small>
      {props.loading ? (
        <Skeleton className='mt-1 h-9 w-32' />
      ) : (
        <div className='truncate font-mono text-[30px] leading-tight font-semibold tracking-tight tabular-nums'>
          {props.value}
        </div>
      )}
      <p className='text-muted-foreground mt-1.5 text-[12.5px]'>
        {props.detail}
      </p>
    </div>
  )
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const affQuota = props.user?.aff_quota ?? 0

  return (
    <div className='grid grid-cols-1 gap-3.5 md:grid-cols-3'>
      <StatCard
        label={t('Current Balance')}
        value={formatQuota(props.user?.quota ?? 0)}
        detail={t('Remaining quota')}
        loading={props.loading}
      />
      <StatCard
        label={t('Total Usage')}
        value={formatQuota(props.user?.used_quota ?? 0)}
        detail={t('{{count}} requests in total', {
          count: formatNumber(props.user?.request_count ?? 0, locale),
        })}
        loading={props.loading}
      />
      <StatCard
        label={t('Referral rewards')}
        value={formatQuota(affQuota)}
        detail={
          <>
            {t('Invited {{count}} users', {
              count: props.user?.aff_count ?? 0,
            })}
            {props.onTransfer && affQuota > 0 && (
              <>
                {' · '}
                <Button
                  variant='link'
                  size='sm'
                  className='h-auto p-0 text-[12.5px]'
                  onClick={props.onTransfer}
                  disabled={props.transferDisabled}
                >
                  {t('Transfer to Balance')}
                </Button>
              </>
            )}
          </>
        }
        loading={props.loading}
      />
    </div>
  )
}

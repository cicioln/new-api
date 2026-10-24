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
import { ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  complianceConfirmed?: boolean
  loading?: boolean
  redemption?: {
    enabled: boolean
    code: string
    onCodeChange: (code: string) => void
    onRedeem: () => void
    redeeming: boolean
    topupLink?: string
  }
}

/** Redemption code form plus the referral link, side by side with the top-up card. */
export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  const complianceConfirmed = props.complianceConfirmed !== false

  return (
    <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
      {props.redemption && (
        <div className='mb-[22px]'>
          <h3 className='text-sm font-semibold'>{t('Redemption code')}</h3>
          <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
            {t(
              'Enter a code issued by the administrator; the quota is added to your balance.'
            )}
          </p>
          {props.redemption.enabled ? (
            <>
              <div className='flex gap-2'>
                <Input
                  id='redemption-code'
                  aria-label={t('Redemption code')}
                  value={props.redemption.code}
                  onChange={(e) =>
                    props.redemption?.onCodeChange(e.target.value)
                  }
                  placeholder='xxxx-xxxx-xxxx-xxxx'
                  className='h-10 min-w-0 flex-1'
                />
                <Button
                  variant='outline'
                  className='h-10 px-4'
                  onClick={props.redemption.onRedeem}
                  disabled={props.redemption.redeeming}
                >
                  {props.redemption.redeeming && (
                    <Loader2 className='animate-spin' />
                  )}
                  {t('Redeem')}
                </Button>
              </div>
              {props.redemption.topupLink && (
                <p className='text-muted-foreground mt-2 text-xs'>
                  {t('Need a redemption code?')}{' '}
                  <a
                    href={props.redemption.topupLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 underline-offset-4 hover:underline'
                  >
                    {t('Get one here')}
                    <ExternalLink className='size-3' />
                  </a>
                </p>
              )}
            </>
          ) : (
            <Alert>
              <AlertDescription>
                {t(
                  'Redemption codes are disabled until the administrator confirms compliance terms.'
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <h3 className='text-sm font-semibold'>{t('Referral link')}</h3>
      <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t(
          'Earn rewards when users join through your referral link. Transfer accumulated rewards to your balance anytime.'
        )}
      </p>
      {props.loading ? (
        <Skeleton className='h-9 w-full' />
      ) : (
        <div className='bg-muted flex items-center gap-2 rounded-md py-1 ps-2.5 pe-1'>
          <span className='min-w-0 flex-1 truncate font-mono text-[12.5px]'>
            {props.affiliateLink}
          </span>
          <CopyButton
            value={props.affiliateLink}
            className='size-7'
            iconClassName='size-3.5'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
        </div>
      )}
      <dl className='mt-3.5 grid grid-cols-3 gap-2 text-center'>
        {[
          [t('Pending'), formatQuota(props.user?.aff_quota ?? 0)],
          [t('Total Earned'), formatQuota(props.user?.aff_history_quota ?? 0)],
          [t('Invites'), String(props.user?.aff_count ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className='bg-muted/50 rounded-md px-2 py-2'>
            <dt className='text-muted-foreground truncate text-[11px]'>
              {label}
            </dt>
            <dd className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {!complianceConfirmed && (
        <p className='text-muted-foreground mt-2 text-xs'>
          {t(
            'Referral reward transfer is disabled until the administrator confirms compliance terms.'
          )}
        </p>
      )}
    </section>
  )
}

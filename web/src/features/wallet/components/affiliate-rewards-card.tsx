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
                  {t('Redeem code')}
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
        {t('Earn 10% of the first top-up when a friend registers and tops up.')}
      </p>
      {props.loading ? (
        <Skeleton className='h-9 w-full' />
      ) : (
        <div className='bg-muted flex items-center justify-between gap-2 rounded-[6px] px-2 py-[3px]'>
          <span className='min-w-0 truncate font-mono text-[12.5px]'>
            {props.affiliateLink}
          </span>
          <CopyButton
            value={props.affiliateLink}
            variant='ghost'
            className='text-muted-foreground size-5 shrink-0'
            iconClassName='size-[13px]'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
        </div>
      )}
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

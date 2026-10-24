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

import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/features/profile/hooks/use-profile'

import { AccessTokensCard } from './components/access-tokens-card'
import { AccountActionCard } from './components/account-action-card'
import { LoginSessionsCard } from './components/login-sessions-card'
import { PasskeyCard } from './components/passkey-card'
import { TwoFACard } from './components/two-fa-card'

export function Security() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile, fetchProfile } = useProfile()

  let content: ReactNode
  if (loading) {
    content = (
      <div role='status' aria-label={t('Loading...')} className='space-y-3.5'>
        <Skeleton className='h-60 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    )
  } else if (!profile) {
    content = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('Failed to load profile')}</EmptyTitle>
          <EmptyDescription>
            {t('Refresh the list and try again.')}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          type='button'
          variant='outline'
          onClick={() => void fetchProfile()}
        >
          {t('Retry')}
        </Button>
      </Empty>
    )
  } else {
    content = (
      <div className='space-y-3.5'>
        <section
          aria-label={t('Security & Access')}
          className='bg-card rounded-lg border p-[18px]'
        >
          <AccountActionCard
            action='password'
            username={profile.username}
            hasPassword={profile.has_password}
            onUpdate={refreshProfile}
          />
          <TwoFACard loading={loading} />
          <PasskeyCard loading={loading} />
          <AccessTokensCard />
          <AccountActionCard action='delete' username={profile.username} />
        </section>
        <LoginSessionsCard />
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Security & Access')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Password, two-factor authentication, passkeys and access tokens.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>{content}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

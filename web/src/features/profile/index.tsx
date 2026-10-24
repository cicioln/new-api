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

import { SectionPageLayout } from '@/components/layout'
import { AccountBindings } from '@/features/security/components/account-bindings'
import { useStatus } from '@/hooks/use-status'

import { BasicInfoCard } from './components/basic-info-card'
import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { ProfileHeader } from './components/profile-header'
import { useProfile } from './hooks'

const ROW_CLASS = 'grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, updating, refreshProfile, updateProfile } =
    useProfile()
  const { status } = useStatus()

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Profile')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Account information, group and third-party account bindings.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3.5'>
          <div className={ROW_CLASS}>
            <ProfileHeader profile={profile} loading={loading} />
            <BasicInfoCard
              profile={profile}
              loading={loading}
              updating={updating}
              onSave={updateProfile}
              onProfileUpdate={refreshProfile}
            />
          </div>
          <div className={ROW_CLASS}>
            {checkinEnabled && (
              <CheckinCalendarCard
                checkinEnabled={checkinEnabled}
                turnstileEnabled={turnstileEnabled}
                turnstileSiteKey={turnstileSiteKey}
              />
            )}
            <section
              aria-labelledby='profile-bindings'
              className='bg-card min-w-0 rounded-lg border p-[18px] lg:col-start-2'
            >
              <h3 id='profile-bindings' className='text-sm font-semibold'>
                {t('Linked accounts')}
              </h3>
              <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
                {t(
                  'Only sign-in methods enabled by the administrator are shown.'
                )}
              </p>
              <AccountBindings profile={profile} onUpdate={refreshProfile} />
            </section>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

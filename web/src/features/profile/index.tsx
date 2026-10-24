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
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { useProfile } from './hooks'

export function Profile() {
  const { t } = useTranslation()
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings !== false

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Profile')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Account information, group and preferences.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3.5'>
          <div className='grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start'>
            <ProfileHeader profile={profile} loading={loading} />
            <div className='min-w-0 space-y-3.5'>
              <ProfileSettingsCard
                profile={profile}
                loading={loading}
                onProfileUpdate={refreshProfile}
              />
              <LanguagePreferencesCard
                profile={profile}
                onProfileUpdate={refreshProfile}
              />
            </div>
          </div>
          {(checkinEnabled || canConfigureSidebar) && (
            <div className='grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start'>
              {checkinEnabled && (
                <CheckinCalendarCard
                  checkinEnabled={checkinEnabled}
                  turnstileEnabled={turnstileEnabled}
                  turnstileSiteKey={turnstileSiteKey}
                />
              )}
              {canConfigureSidebar && <SidebarModulesCard />}
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

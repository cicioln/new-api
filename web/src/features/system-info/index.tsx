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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSystemUpdate } from '@/features/system-update/use-system-update'

import { SystemInstancesPanel } from './components/system-instances-panel'
import { SystemOverview } from './components/system-overview'
import { SystemTasksPanel } from './components/system-tasks-panel'
import { SystemUpdateNotice } from './components/system-update-notice'

export function SystemInfo() {
  const { t } = useTranslation()
  const update = useSystemUpdate()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('System Info')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Version, runtime environment and resource usage.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          size='sm'
          aria-busy={update.checking}
          disabled={update.checking || !update.online}
          onClick={() => void update.checkNow()}
        >
          {update.checking ? (
            <Spinner data-icon='inline-start' aria-hidden='true' />
          ) : (
            <HugeiconsIcon
              icon={RefreshIcon}
              data-icon='inline-start'
              aria-hidden='true'
            />
          )}
          {t('Check for updates')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <SystemUpdateNotice update={update} />
        <div className='space-y-3.5'>
          <SystemOverview />
          <SystemInstancesPanel />
          <SystemTasksPanel />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

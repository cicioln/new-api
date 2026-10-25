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

import { LogoMark } from '@/components/layout/components/logo-mark'
import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import { ErrorFrame } from './error-frame'

export function MaintenanceError() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  return (
    <ErrorFrame
      className='mt-[18vh]'
      leading={
        <div className='text-foreground mb-7 flex items-center justify-center gap-2.5 text-base font-bold tracking-[-0.01em]'>
          <LogoMark />
          <span>{systemName || 'New API'}</span>
        </div>
      }
      title={t('System under maintenance')}
      actions={
        <Button
          size='sm'
          variant='outline'
          onClick={() => window.location.reload()}
        >
          {t('Check again')}
        </Button>
      }
    >
      {t(
        'API calls are not affected during maintenance; the console is temporarily unavailable.'
      )}
    </ErrorFrame>
  )
}

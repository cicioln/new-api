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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorFrame } from './error-frame'

export function NotFoundError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <ErrorFrame
      code={404}
      title={t('Page not found')}
      actions={
        <>
          <Button size='sm' onClick={() => navigate({ to: '/' })}>
            {t('Back to home page')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => navigate({ to: '/pricing' })}
          >
            {t('Browse models')}
          </Button>
        </>
      }
    >
      {t('The link may have expired, or the page has been moved.')}
    </ErrorFrame>
  )
}

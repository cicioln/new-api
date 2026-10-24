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

export function UnauthorisedError() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const redirect =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`
  return (
    <ErrorFrame
      code={401}
      title={t('Session expired')}
      actions={
        <>
          <Button
            size='sm'
            onClick={() => navigate({ to: '/sign-in', search: { redirect } })}
          >
            {t('Sign in again')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => navigate({ to: '/' })}
          >
            {t('Back to Home')}
          </Button>
        </>
      }
    >
      {t(
        'For account security, you need to sign in again after a long period of inactivity or a password change on another device. You will return to this page after signing in.'
      )}
    </ErrorFrame>
  )
}

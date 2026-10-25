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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { AuthLayout } from '../auth-layout'
import { AUTH_SUBMIT_CLASS, AuthAlt, AuthHeader } from '../components/auth-ui'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const registerClosed =
    status?.self_use_mode_enabled === true || status?.register_enabled === false

  if (registerClosed) {
    return (
      <AuthLayout>
        <AuthHeader
          title={t('Registration is closed')}
          description={t(
            'The administrator has disabled new user registration. Contact the administrator for an account, or sign in with a linked third-party account.'
          )}
        />
        <Button className={AUTH_SUBMIT_CLASS} render={<Link to='/sign-in' />}>
          {t('Back to sign in')}
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthHeader
        title={t('Create account')}
        description={t(
          'After signing up you can create API keys. New users join the default group.'
        )}
      />
      <SignUpForm />
      <AuthAlt>
        {t('Already have an account?')}
        <Link to='/sign-in'>{t('Sign in directly')}</Link>
      </AuthAlt>
    </AuthLayout>
  )
}

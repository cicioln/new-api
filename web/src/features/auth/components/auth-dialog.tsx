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

import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useStatus } from '@/hooks/use-status'
import { useAuthDialogStore } from '@/stores/auth-dialog-store'
import { useAuthStore } from '@/stores/auth-store'

import { UserAuthForm } from '../sign-in/components/user-auth-form'
import { SignUpForm } from '../sign-up/components/sign-up-form'
import { AUTH_SUBMIT_CLASS, AuthAlt } from './auth-ui'

/**
 * Sign-in and sign-up in a dialog over the current page. It closes once the
 * user is signed in or the flow navigates away (for example to /otp).
 */
export function AuthDialog() {
  const { t } = useTranslation()
  const mode = useAuthDialogStore((state) => state.mode)
  const redirect = useAuthDialogStore((state) => state.redirect)
  const openMode = useAuthDialogStore((state) => state.open)
  const close = useAuthDialogStore((state) => state.close)
  const openedAt = useAuthDialogStore((state) => state.openedAt)
  const signedIn = useAuthStore((state) => Boolean(state.auth.user))
  const pathname = useLocation({ select: (location) => location.pathname })
  const { status } = useStatus()
  const registerClosed =
    status?.self_use_mode_enabled === true || status?.register_enabled === false

  useEffect(() => {
    if (signedIn) close()
  }, [signedIn, close])
  useEffect(() => {
    if (openedAt && pathname !== openedAt) close()
  }, [pathname, openedAt, close])

  let title = t('Sign in to your account')
  let description = t('Welcome back. Pick up where you left off.')
  if (mode === 'sign-up') {
    title = registerClosed ? t('Registration is closed') : t('Create account')
    description = registerClosed
      ? t(
          'The administrator has disabled new user registration. Contact the administrator for an account, or sign in with a linked third-party account.'
        )
      : t(
          'After signing up you can create API keys. New users join the default group.'
        )
  }

  let body: React.ReactNode
  if (mode === 'sign-up' && registerClosed) {
    body = (
      <Button
        className={AUTH_SUBMIT_CLASS}
        onClick={() => openMode('sign-in', redirect)}
      >
        {t('Back to sign in')}
      </Button>
    )
  } else if (mode === 'sign-up') {
    body = (
      <>
        <SignUpForm redirectTo={redirect} />
        <AuthAlt>
          {t('Already have an account?')}
          <button type='button' onClick={() => openMode('sign-in', redirect)}>
            {t('Sign in directly')}
          </button>
        </AuthAlt>
      </>
    )
  } else {
    body = (
      <>
        <UserAuthForm redirectTo={redirect} />
        {!registerClosed && (
          <AuthAlt>
            {t('No account yet?')}
            <button type='button' onClick={() => openMode('sign-up', redirect)}>
              {t('Sign up for free')}
            </button>
          </AuthAlt>
        )}
      </>
    )
  }

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className='max-h-[calc(100dvh-32px)] w-[min(420px,calc(100%-32px))] overflow-y-auto p-7 sm:max-w-none'>
        <div className='mb-6'>
          <DialogTitle className='text-[22px] leading-[1.4] font-bold tracking-[-0.02em]'>
            {title}
          </DialogTitle>
          <p className='text-subtle-foreground mt-1.5 text-sm leading-[1.55]'>
            {description}
          </p>
        </div>
        {body}
      </DialogContent>
    </Dialog>
  )
}

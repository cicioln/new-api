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
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { Fingerprint, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { useAuthStore } from '@/stores/auth-store'

import {
  AUTH_FIELD_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_OUTLINE_CLASS,
  AUTH_SUBMIT_CLASS,
  AuthAlt,
  AuthBackLink,
  AuthHeader,
} from '../../components/auth-ui'
import { BACKUP_CODE_LENGTH, OTP_LENGTH } from '../../constants'
import { useAuthRedirect } from '../../hooks/use-auth-redirect'
import { PasskeyDomainSelector } from '../../passkey/components/passkey-domain-selector'
import { useSecureVerification } from '../../secure-verification'

/** 52px mono digit cell, six to a row. */
const OTP_SLOT_CLASS =
  'bg-card border-input data-[active=true]:border-foreground h-[52px] w-full rounded-lg border font-mono text-xl first:rounded-lg last:rounded-lg data-[active=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_22%,transparent)] data-[active=true]:ring-0 max-sm:h-[46px]'

export function OtpForm() {
  const { t } = useTranslation()
  // Transfer the pending challenge from the navigation handoff into this page's
  // lifetime. Reloading or leaving the page cannot resume it from browser storage.
  const pending = useRef(
    useAuthStore.getState().auth.pendingLoginVerification
  ).current
  const initialSessionID = useRef(
    useAuthStore.getState().auth.session?.sid
  ).current
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const verification = useSecureVerification()
  const { requestLoginVerification, cancel } = verification
  const { handleLoginSuccess, redirectToLogin } = useAuthRedirect()
  const completed = useRef(false)
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [rpID, setRpID] = useState<string | undefined>()

  useEffect(() => {
    if (completed.current) return
    if (!pending) {
      redirectToLogin()
      return
    }
    if (sessionID !== initialSessionID) {
      cancel()
      return
    }
    if (useAuthStore.getState().auth.pendingLoginVerification === pending) {
      useAuthStore.getState().auth.setPendingLoginVerification(null)
    }
    let active = true
    void (async () => {
      try {
        const bundle = await requestLoginVerification(pending.challenge)
        if (
          !active ||
          useAuthStore.getState().auth.session?.sid !== initialSessionID
        ) {
          return
        }
        if (!bundle) {
          redirectToLogin()
          return
        }
        completed.current = true
        await handleLoginSuccess(bundle, pending.redirectTo)
        toast.success(t('Signed in'))
      } catch (error) {
        if (!active) return
        handleServerError(AuthOperationError.from(error))
        redirectToLogin()
      }
    })()
    return () => {
      active = false
      cancel()
    }
  }, [
    pending,
    initialSessionID,
    sessionID,
    requestLoginVerification,
    cancel,
    handleLoginSuccess,
    redirectToLogin,
    t,
  ])

  const flow = verification.dialogProps
  const state = flow.state
  const ready =
    state.phase === 'ready' || state.phase === 'verifying' ? state : null
  const verifying = state.phase === 'verifying'
  const methods = ready?.requirements.methods ?? []
  const has2fa = methods.some(
    (option) => option.method === '2fa' && option.available
  )
  const hasPasskey = methods.some(
    (option) => option.method === 'passkey' && option.available
  )
  const error = 'error' in state ? state.error : undefined
  const codeLength = useBackup ? BACKUP_CODE_LENGTH : OTP_LENGTH
  const canVerify =
    state.phase === 'ready' && has2fa && code.trim().length >= codeLength

  const submitCode = () => {
    if (!canVerify) return
    const submitted = code
    setCode('')
    void flow.onVerify({ method: '2fa', code: submitted })
  }

  let description = t('Verify your identity to finish signing in.')
  if (has2fa && pending?.username) {
    description = t(
      'Open your authenticator app and enter the 6-digit code for the {{username}} account.',
      { username: pending.username }
    )
  } else if (has2fa) {
    description = t('Open your authenticator app and enter the 6-digit code.')
  }

  let passkeyClass = AUTH_SUBMIT_CLASS
  if (has2fa) passkeyClass = `mt-2 ${AUTH_OUTLINE_CLASS}`

  return (
    <>
      <AuthBackLink to='/sign-in'>{t('Switch account')}</AuthBackLink>
      <AuthHeader
        title={t('Two-step verification')}
        description={description}
      />

      {state.phase === 'loading' && (
        <div
          role='status'
          className='text-subtle-foreground flex items-center gap-2 text-sm'
        >
          <Loader2 className='size-4 animate-spin' />
          {t('Loading verification methods...')}
        </div>
      )}
      {error && (
        <p role='alert' className='text-destructive mb-3 text-sm'>
          {t(error)}
        </p>
      )}
      {state.phase === 'error' && (
        <Button
          type='button'
          className={AUTH_SUBMIT_CLASS}
          onClick={flow.onRetry}
        >
          {t('Retry')}
        </Button>
      )}
      {ready && !has2fa && !hasPasskey && (
        <p className='text-subtle-foreground text-sm'>
          {t('No verification method is available for this action.')}
        </p>
      )}

      {ready && has2fa && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submitCode()
          }}
        >
          {useBackup && (
            <div className={`mt-1 mb-[18px] grid ${AUTH_FIELD_CLASS}`}>
              <Label htmlFor='otp-backup-code' className={AUTH_LABEL_CLASS}>
                {t('Backup code')}
              </Label>
              <Input
                id='otp-backup-code'
                autoComplete='one-time-code'
                autoFocus
                maxLength={BACKUP_CODE_LENGTH}
                placeholder='XXXX-XXXX'
                disabled={verifying}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={`${AUTH_INPUT_CLASS} font-mono`}
              />
            </div>
          )}
          {!useBackup && (
            <InputOTP
              aria-label={t('Authenticator code')}
              maxLength={OTP_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              autoFocus
              disabled={verifying}
              value={code}
              onChange={setCode}
              containerClassName='mt-1 mb-[18px] grid grid-cols-6 gap-2'
            >
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className={OTP_SLOT_CLASS}
                />
              ))}
            </InputOTP>
          )}
          <Button
            type='submit'
            className={AUTH_SUBMIT_CLASS}
            disabled={!canVerify}
          >
            {verifying && <Loader2 className='size-4 animate-spin' />}
            {t('Verify and sign in')}
          </Button>
        </form>
      )}

      {ready && hasPasskey && (
        <>
          <Button
            type='button'
            variant={has2fa ? 'outline' : 'default'}
            className={passkeyClass}
            disabled={verifying}
            onClick={() => void flow.onVerify({ method: 'passkey', rpID })}
          >
            <Fingerprint className='size-4' />
            {t('Verify with Passkey')}
          </Button>
          <div className='mt-2'>
            <PasskeyDomainSelector
              domains={flow.passkeyDomains}
              value={rpID}
              onChange={setRpID}
              disabled={verifying}
            />
          </div>
        </>
      )}

      {ready && has2fa && (
        <AuthAlt>
          {useBackup
            ? t('Have your authenticator?')
            : t("Can't use your authenticator?")}
          <button
            type='button'
            className='text-foreground font-medium underline underline-offset-[3px]'
            onClick={() => {
              setCode('')
              setUseBackup(!useBackup)
            }}
          >
            {useBackup ? t('Use authenticator code') : t('Use a backup code')}
          </button>
        </AuthAlt>
      )}
    </>
  )
}

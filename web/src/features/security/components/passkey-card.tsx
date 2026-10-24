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
import { Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePasskeyManagement } from '@/features/auth/passkey'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

import { SecurityRow, SecurityTag } from './security-row'

interface PasskeyCardProps {
  loading: boolean
}

/** Passkey row of the security list. */
export function PasskeyCard(props: PasskeyCardProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const passkey = usePasskeyManagement()
  const verification = useSecureVerification()
  const register = passkey.register
  const remove = passkey.remove
  const busy = passkey.registering || passkey.removing || verification.isActive

  const handleRegister = useCallback(async () => {
    if (busy) return
    const proof = await verification.requestVerification({
      scope: 'passkey.register',
    })
    if (!proof) return
    try {
      await register(proof.proof_token)
      toast.success(t('Passkey registered successfully'))
    } catch (error) {
      const failure = AuthOperationError.from(error)
      if (failure.code !== 'AUTH_CANCELLED') handleServerError(failure)
    }
  }, [busy, register, t, verification])

  const handleRemove = useCallback(async () => {
    if (busy) return
    setConfirmOpen(false)
    const proof = await verification.requestVerification({
      scope: 'passkey.delete',
    })
    if (!proof) return
    try {
      await remove(proof.proof_token)
      toast.success(t('Passkey removed successfully'))
    } catch (error) {
      const failure = AuthOperationError.from(error)
      if (failure.code !== 'AUTH_CANCELLED') handleServerError(failure)
    }
  }, [busy, remove, t, verification])

  if (props.loading || passkey.loading) {
    return (
      <SecurityRow
        title={t('Passkey')}
        description={<Skeleton className='mt-1 h-3.5 w-56' />}
      />
    )
  }

  if (passkey.statusError) {
    return (
      <SecurityRow
        title={t('Passkey')}
        description={<span role='alert'>{t(passkey.statusError)}</span>}
        actions={
          <Button
            size='sm'
            variant='outline'
            onClick={() => void passkey.fetchStatus()}
          >
            {t('Retry')}
          </Button>
        }
      />
    )
  }

  let description = t('Use Passkey to sign in without entering your password.')
  if (passkey.enabled) {
    const lastUsed =
      passkey.lastUsed && !Number.isNaN(Date.parse(passkey.lastUsed))
        ? formatTimestampRelative(
            Date.parse(passkey.lastUsed),
            'milliseconds',
            locale
          )
        : t('Not used yet')
    description = `${t('Last used:')} ${lastUsed}`
  } else if (!passkey.supported) {
    description = t('Passkey not supported on this device')
  }

  let actions = (
    <Button
      size='sm'
      onClick={handleRegister}
      disabled={!passkey.supported || busy}
    >
      {passkey.registering && <Loader2 className='animate-spin' />}
      {t('Add Passkey')}
    </Button>
  )
  if (passkey.enabled) {
    actions = (
      <Button
        size='sm'
        variant='outline'
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
      >
        {passkey.removing && <Loader2 className='animate-spin' />}
        {t('Remove Passkey')}
      </Button>
    )
  }

  return (
    <SecurityRow
      title={
        <>
          {t('Passkey')}
          <SecurityTag
            label={passkey.enabled ? t('Enabled') : t('Not enabled')}
            active={passkey.enabled}
          />
        </>
      }
      description={description}
      actions={actions}
    >
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('Remove Passkey?')}
        desc={t(
          'Removing Passkey will require you to sign in with your password next time. You can re-register anytime.'
        )}
        confirmText={t('Remove')}
        destructive
        isLoading={passkey.removing}
        handleConfirm={() => void handleRemove()}
      />
      <SecureVerificationDialog {...verification.dialogProps} />
    </SecurityRow>
  )
}

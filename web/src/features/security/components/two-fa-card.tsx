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

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SecureVerificationDialog } from '@/features/auth/secure-verification'
import { useDialogs } from '@/hooks/use-dialog'

import { useTwoFA } from '../hooks/use-two-fa'
import { useTwoFASetup } from '../hooks/use-two-fa-setup'
import { TwoFABackupDialog } from './dialogs/two-fa-backup-dialog'
import { TwoFADisableDialog } from './dialogs/two-fa-disable-dialog'
import { TwoFASetupDialog } from './dialogs/two-fa-setup-dialog'
import { SecurityRow, SecurityTag } from './security-row'

interface TwoFACardProps {
  loading: boolean
}

type DialogKey = 'disable' | 'backup'

/** Two-factor authentication row of the security list. */
export function TwoFACard(props: TwoFACardProps) {
  const { t } = useTranslation()
  const { status, loading, error, refetch } = useTwoFA(!props.loading)
  const dialogs = useDialogs<DialogKey>()
  const setup = useTwoFASetup(refetch)
  const title = t('Two-factor authentication (TOTP)')

  if (props.loading || loading) {
    return (
      <SecurityRow
        title={title}
        description={<Skeleton className='mt-1 h-3.5 w-64' />}
      />
    )
  }

  if (error) {
    return (
      <SecurityRow
        title={title}
        description={<span role='alert'>{t(error)}</span>}
        actions={
          <Button size='sm' variant='outline' onClick={() => void refetch()}>
            {t('Retry')}
          </Button>
        }
      />
    )
  }

  let actions = (
    <Button size='sm' onClick={setup.start} disabled={setup.active}>
      {t('Enable')}
    </Button>
  )
  if (status.enabled) {
    actions = (
      <>
        <Button
          size='sm'
          variant='outline'
          onClick={() => dialogs.open('backup')}
        >
          {t('Regenerate backup codes')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => dialogs.open('disable')}
        >
          {t('Close')}
        </Button>
      </>
    )
  }

  return (
    <SecurityRow
      title={
        <>
          {title}
          <SecurityTag
            label={status.enabled ? t('Enabled') : t('Not enabled')}
            active={status.enabled}
          />
          {status.locked && <SecurityTag label={t('Locked')} active={false} />}
        </>
      }
      description={
        status.enabled
          ? `${t('Enter the 6-digit code from your authenticator app when signing in')} · ${t(
              'Backup codes remaining: {{count}}',
              { count: status.backup_codes_remaining }
            )}`
          : t('Add an extra layer of security to your account')
      }
      actions={actions}
    >
      <SecureVerificationDialog {...setup.verificationDialogProps} />
      <TwoFASetupDialog
        key={setup.setupDialogProps.setupData?.flow_token ?? 'initializing'}
        {...setup.setupDialogProps}
      />
      <TwoFADisableDialog
        open={dialogs.isOpen('disable')}
        onOpenChange={(open) =>
          open ? dialogs.open('disable') : dialogs.close('disable')
        }
        onSuccess={refetch}
      />
      <TwoFABackupDialog
        open={dialogs.isOpen('backup')}
        onOpenChange={(open) =>
          open ? dialogs.open('backup') : dialogs.close('backup')
        }
        onSuccess={refetch}
      />
    </SecurityRow>
  )
}

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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ChangePasswordDialog } from './dialogs/change-password-dialog'
import { DeleteAccountDialog } from './dialogs/delete-account-dialog'
import { SecurityRow } from './security-row'

type AccountActionCardProps = {
  action: 'password' | 'delete'
  username: string
  hasPassword?: boolean
  onUpdate?: () => void
}

/** Password or account deletion row of the security list. */
export function AccountActionCard(props: AccountActionCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (props.action === 'delete') {
    return (
      <SecurityRow
        title={t('Delete Account')}
        description={t('Permanently delete your account and all data')}
        actions={
          <Button size='sm' variant='destructive' onClick={() => setOpen(true)}>
            {t('Delete Account')}
          </Button>
        }
      >
        <DeleteAccountDialog
          open={open}
          onOpenChange={setOpen}
          username={props.username}
        />
      </SecurityRow>
    )
  }

  const noPassword = props.hasPassword === false
  return (
    <SecurityRow
      title={t('Login password')}
      description={
        noPassword
          ? t('Add a password after verifying your identity')
          : t('Update your password to keep your account secure')
      }
      actions={
        <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
          {noPassword ? t('Set Password') : t('Change Password')}
        </Button>
      }
    >
      <ChangePasswordDialog
        open={open}
        onOpenChange={setOpen}
        username={props.username}
        hasPassword={props.hasPassword}
        onSuccess={props.onUpdate}
      />
    </SecurityRow>
  )
}

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
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

import { handleTestAllChannels, handleUpdateAllBalances } from '../lib'
import { useChannels } from './channels-provider'

export function ChannelsPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useChannels()
  const queryClient = useQueryClient()
  const [testing, setTesting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const currentUser = useAuthStore((s) => s.auth.user)
  const canEditSensitive = hasPermission(
    currentUser,
    ADMIN_PERMISSION_RESOURCES.CHANNEL,
    ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
  )

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        variant='outline'
        size='sm'
        disabled={testing}
        onClick={async () => {
          setTesting(true)
          try {
            await handleTestAllChannels(queryClient)
          } finally {
            setTesting(false)
          }
        }}
      >
        {testing && <Loader2 className='animate-spin' aria-hidden='true' />}
        {t('Test all')}
      </Button>
      <Button
        variant='outline'
        size='sm'
        disabled={updating}
        onClick={async () => {
          setUpdating(true)
          try {
            await handleUpdateAllBalances(queryClient)
          } finally {
            setUpdating(false)
          }
        }}
      >
        {updating && <Loader2 className='animate-spin' aria-hidden='true' />}
        {t('Update balances')}
      </Button>
      <Button
        size='sm'
        disabled={!canEditSensitive}
        title={
          canEditSensitive
            ? undefined
            : t('No permission to perform this action')
        }
        onClick={() => {
          setCurrentRow(null)
          setOpen('create-channel')
        }}
      >
        <Plus aria-hidden='true' />
        {t('Add channel')}
      </Button>
    </div>
  )
}

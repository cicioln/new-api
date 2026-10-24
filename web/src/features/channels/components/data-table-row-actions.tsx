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
import type { Row } from '@tanstack/react-table'
import {
  Boxes,
  Copy,
  DollarSign,
  Download,
  Key,
  Loader2,
  Pencil,
  PlugZap,
  Power,
  PowerOff,
  RefreshCw,
  Tag,
  Tags,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

import { MODEL_FETCHABLE_TYPES } from '../constants'
import {
  handleDeleteChannel,
  handleToggleChannelStatus,
  isChannelEnabled,
  isMultiKeyChannel,
} from '../lib'
import type { Channel } from '../types'
import { useChannels } from './channels-provider'

interface DataTableRowActionsProps {
  row: Row<Channel>
}

export function DataTableRowActions(props: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const channel = props.row.original
  const { setOpen, setCurrentRow, setCurrentTag, upstream } = useChannels()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.auth.user)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  const isEnabled = isChannelEnabled(channel)
  const canEditSensitive = hasPermission(
    currentUser,
    ADMIN_PERMISSION_RESOURCES.CHANNEL,
    ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
  )

  const openDialog = (dialog: Parameters<typeof setOpen>[0] & string): void => {
    setCurrentRow(channel)
    setOpen(dialog)
  }

  const openTagDialog = (dialog: 'edit-tag' | 'tag-batch-edit') => {
    setCurrentTag(channel.tag ?? null)
    setOpen(dialog)
  }

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true)
    try {
      await handleToggleChannelStatus(channel.id, channel.status, queryClient)
    } finally {
      setIsTogglingStatus(false)
    }
  }

  let statusIcon = <Power size={16} />
  if (isTogglingStatus) {
    statusIcon = <Loader2 size={16} className='animate-spin' />
  } else if (isEnabled) {
    statusIcon = <PowerOff size={16} />
  }

  return (
    <>
      <DataTableRowActionMenu ariaLabel={t('More actions')} modal={false}>
        <DropdownMenuItem onClick={() => openDialog('update-channel')}>
          {t('Edit')}
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isTogglingStatus}
          onClick={() => void handleToggleStatus()}
        >
          {isEnabled ? t('Disable') : t('Enable')}
          <DropdownMenuShortcut>{statusIcon}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openDialog('test-channel')}>
          {t('Test Connection')}
          <DropdownMenuShortcut>
            <PlugZap size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog('balance-query')}>
          {t('Query Balance')}
          <DropdownMenuShortcut>
            <DollarSign size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog('fetch-models')}>
          {t('Fetch Models')}
          <DropdownMenuShortcut>
            <Download size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {MODEL_FETCHABLE_TYPES.has(channel.type) && (
          <DropdownMenuItem
            onClick={() => upstream.detectChannelUpdates(channel)}
          >
            {t('Upstream Updates')}
            <DropdownMenuShortcut>
              <RefreshCw size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        {channel.type === 4 && (
          <DropdownMenuItem onClick={() => openDialog('ollama-models')}>
            {t('Manage Ollama Models')}
            <DropdownMenuShortcut>
              <Boxes size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canEditSensitive}
          onClick={
            canEditSensitive ? () => openDialog('copy-channel') : undefined
          }
        >
          {t('Copy Channel')}
          <DropdownMenuShortcut>
            <Copy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {isMultiKeyChannel(channel) && (
          <DropdownMenuItem onClick={() => openDialog('multi-key-manage')}>
            {t('Manage Keys')}
            <DropdownMenuShortcut>
              <Key size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        {channel.tag && (
          <>
            <DropdownMenuItem onClick={() => openTagDialog('edit-tag')}>
              {t('Edit Tag')}
              <DropdownMenuShortcut>
                <Tag size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTagDialog('tag-batch-edit')}>
              {t('Batch Edit by Tag')}
              <DropdownMenuShortcut>
                <Tags size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canEditSensitive}
          onClick={() => {
            if (canEditSensitive) setDeleteConfirmOpen(true)
          }}
          className='text-destructive focus:text-destructive'
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('Delete Channel')}
        desc={t(
          'Are you sure you want to delete channel "{{name}}"? This action cannot be undone.',
          { name: channel.name }
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (!canEditSensitive) return
          handleDeleteChannel(channel.id, queryClient)
          setDeleteConfirmOpen(false)
        }}
      />
    </>
  )
}

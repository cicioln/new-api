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
import type { Table } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

import {
  channelsQueryKeys,
  handleBatchDelete,
  handleBatchDisable,
  handleBatchEnable,
  handleBatchSetTag,
  handleTestChannel,
} from '../lib'
import type { Channel } from '../types'

interface DataTableBulkActionsProps {
  table: Table<Channel>
}

export function DataTableBulkActions(props: DataTableBulkActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const currentUser = useAuthStore((s) => s.auth.user)
  const canEditSensitive = hasPermission(
    currentUser,
    ADMIN_PERMISSION_RESOURCES.CHANNEL,
    ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
  )

  const selectedChannels = props.table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)
  const selectedIds = selectedChannels.map((channel) => channel.id)

  const clearSelection = () => {
    props.table.resetRowSelection()
  }

  const handleTestSelected = async () => {
    setIsTesting(true)
    try {
      // One request at a time, like the per-row test, so upstreams are not flooded.
      for (const channel of selectedChannels) {
        await handleTestChannel(channel.id, { channelName: channel.name })
      }
      await queryClient.invalidateQueries({
        queryKey: channelsQueryKeys.lists(),
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <>
      <BulkActionsToolbar
        table={props.table}
        entityName='channel'
        placement='inline'
        variant='bar'
        label={t('Selected {{count}} channels', { count: selectedIds.length })}
      >
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            handleBatchEnable(selectedIds, queryClient, clearSelection)
          }
        >
          {t('Enable')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() =>
            handleBatchDisable(selectedIds, queryClient, clearSelection)
          }
        >
          {t('Disable')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowTagDialog(true)}
        >
          {t('Set Tag')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={isTesting}
          aria-busy={isTesting}
          onClick={() => void handleTestSelected()}
        >
          {t('Test')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={!canEditSensitive}
          title={
            canEditSensitive
              ? undefined
              : t('No permission to perform this action')
          }
          onClick={() => setShowDeleteConfirm(true)}
        >
          {t('Delete')}
        </Button>
      </BulkActionsToolbar>

      <Dialog
        open={showTagDialog}
        onOpenChange={setShowTagDialog}
        title={t('Set Tag')}
        description={
          <>
            {t('Set a tag for')}
            {selectedIds.length}{' '}
            {t('selected channel(s). Leave empty to remove tag.')}
          </>
        }
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => {
                setShowTagDialog(false)
                setTagValue('')
              }}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={() =>
                handleBatchSetTag(
                  selectedIds,
                  tagValue || null,
                  queryClient,
                  () => {
                    setShowTagDialog(false)
                    setTagValue('')
                    clearSelection()
                  }
                )
              }
            >
              {t('Set Tag')}
            </Button>
          </>
        }
      >
        <div className='grid gap-2 py-4'>
          <Label htmlFor='channel-bulk-tag'>{t('Tag')}</Label>
          <Input
            id='channel-bulk-tag'
            placeholder={t('Enter tag name (optional)')}
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('Delete Channels?')}
        desc={`${t('Are you sure you want to delete')}${selectedIds.length} ${t('channel(s)? This action cannot be undone.')}`}
        confirmText={t('Delete')}
        destructive
        disabled={!canEditSensitive}
        handleConfirm={() => {
          if (!canEditSensitive) return
          handleBatchDelete(selectedIds, queryClient, () => {
            setShowDeleteConfirm(false)
            clearSelection()
          })
        }}
      />
    </>
  )
}

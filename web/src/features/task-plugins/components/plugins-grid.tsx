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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { handleServerError } from '@/lib/handle-server-error'

import {
  deleteTaskPluginVersion,
  listTaskPlugins,
  setTaskPluginStatus,
  TaskPluginUsageError,
} from '../api'
import type { TaskPluginListItem, TaskPluginUsage } from '../types'
import { PluginCard } from './plugin-card'

const GRID_CLASS_NAME = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3'

type PluginsGridProps = {
  onDetails: (plugin: TaskPluginListItem) => void
  onUpload: (key: string) => void
}

export function PluginsGrid(props: PluginsGridProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<TaskPluginListItem | null>(
    null
  )
  const [blockedUsage, setBlockedUsage] = useState<TaskPluginUsage | null>(null)
  const [blockedAction, setBlockedAction] = useState<
    'delete' | 'disable' | null
  >(null)
  const [statusTarget, setStatusTarget] = useState<TaskPluginListItem | null>(
    null
  )
  const [statusConfirmation, setStatusConfirmation] = useState<{
    plugin: TaskPluginListItem
    enabled: boolean
  } | null>(null)
  const pluginsQuery = useQuery({
    queryKey: ['task-plugins'],
    queryFn: listTaskPlugins,
  })
  const statusMutation = useMutation({
    mutationFn: ({
      key,
      enabled,
      options,
    }: {
      key: string
      enabled: boolean
      options?: { cascade?: boolean; force?: boolean }
    }) => setTaskPluginStatus(key, enabled, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
      setStatusConfirmation(null)
      setStatusTarget(null)
      setBlockedAction(null)
      setBlockedUsage(null)
    },
    onError: (error) => {
      if (error instanceof TaskPluginUsageError) {
        setStatusConfirmation(null)
        setBlockedUsage(error.usage)
        setBlockedAction('disable')
        return
      }
      handleServerError(error)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: ({
      plugin,
      force,
    }: {
      plugin: TaskPluginListItem
      force?: boolean
    }) => deleteTaskPluginVersion(plugin.meta.key, plugin.meta.version, force),
    onSuccess: () => {
      setDeleteTarget(null)
      setBlockedAction(null)
      setBlockedUsage(null)
      toast.success(t('Plugin version deleted'))
      queryClient.invalidateQueries({ queryKey: ['task-plugins'] })
    },
    onError: (error) => {
      if (error instanceof TaskPluginUsageError) {
        setBlockedUsage(error.usage)
        setBlockedAction('delete')
        return
      }
      handleServerError(error)
    },
  })
  const plugins = pluginsQuery.data ?? []
  const hasFactoryFallback = Boolean(deleteTarget?.factory_meta)
  const usageDescription = blockedUsage ? (
    <div className='space-y-2'>
      <p>
        {t(
          '{{count}} enabled channels and {{tasks}} in-flight tasks still use this plugin.',
          {
            count: blockedUsage.channels.length,
            tasks: blockedUsage.in_flight_count,
          }
        )}
      </p>
      {blockedUsage.channels.length > 0 && (
        <ul className='list-disc pl-5'>
          {blockedUsage.channels.map((channel) => (
            <li key={channel.id}>
              #{channel.id} {channel.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : (
    ''
  )
  return (
    <>
      {pluginsQuery.isLoading && (
        <div className={GRID_CLASS_NAME}>
          <Skeleton className='h-[150px] rounded-[10px]' />
          <Skeleton className='h-[150px] rounded-[10px]' />
          <Skeleton className='h-[150px] rounded-[10px]' />
        </div>
      )}
      {!pluginsQuery.isLoading && plugins.length === 0 && (
        <EmptyState
          bordered
          title={t('No task plugins found')}
          description={t('Upload a task plugin to add a platform.')}
        />
      )}
      {plugins.length > 0 && (
        <div className={GRID_CLASS_NAME}>
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.meta.key}
              plugin={plugin}
              switchDisabled={statusMutation.isPending}
              onToggle={(enabled) => setStatusConfirmation({ plugin, enabled })}
              onDetails={() => props.onDetails(plugin)}
              onUpload={() => props.onUpload(plugin.meta.key)}
              onDelete={() => setDeleteTarget(plugin)}
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(statusConfirmation)}
        onOpenChange={(open) => {
          if (!open && !statusMutation.isPending) setStatusConfirmation(null)
        }}
        title={
          statusConfirmation?.enabled
            ? t('Enable plugin?')
            : t('Disable plugin?')
        }
        desc={
          statusConfirmation?.enabled
            ? t('Are you sure you want to enable plugin {{name}} ({{key}})?', {
                name: statusConfirmation.plugin.meta.name,
                key: statusConfirmation.plugin.meta.key,
              })
            : t(
                'Disable plugin {{name}} ({{key}})? Requests using this plugin may be affected.',
                {
                  name: statusConfirmation?.plugin.meta.name,
                  key: statusConfirmation?.plugin.meta.key,
                }
              )
        }
        destructive={!statusConfirmation?.enabled}
        isLoading={statusMutation.isPending}
        confirmText={statusConfirmation?.enabled ? t('Enable') : t('Disable')}
        handleConfirm={() => {
          if (!statusConfirmation || statusMutation.isPending) return
          setStatusTarget(statusConfirmation.plugin)
          statusMutation.mutate({
            key: statusConfirmation.plugin.meta.key,
            enabled: statusConfirmation.enabled,
          })
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete plugin version?')}
        destructive
        isLoading={deleteMutation.isPending}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ plugin: deleteTarget })
        }}
        desc={
          hasFactoryFallback
            ? t(
                'Deleting this custom version does not disable the platform. The same-name factory plugin will be restored automatically.'
              )
            : t(
                'This plugin has no factory fallback. Deleting or disabling it makes this platform unavailable.'
              )
        }
      />
      <ConfirmDialog
        open={Boolean(blockedAction)}
        onOpenChange={(open) => {
          if (!open) {
            setBlockedAction(null)
            setBlockedUsage(null)
          }
        }}
        title={t('Plugin is still in use')}
        desc={usageDescription}
        destructive
        isLoading={statusMutation.isPending || deleteMutation.isPending}
        confirmText={t('Force operation')}
        handleConfirm={() => {
          if (blockedAction === 'delete' && deleteTarget) {
            deleteMutation.mutate({ plugin: deleteTarget, force: true })
          } else if (blockedAction === 'disable' && statusTarget) {
            statusMutation.mutate({
              key: statusTarget.meta.key,
              enabled: false,
              options: { cascade: true, force: true },
            })
          }
        }}
      >
        {blockedAction === 'disable' && blockedUsage?.channels.length ? (
          <div className='flex'>
            <Button
              variant='outline'
              onClick={() =>
                statusTarget &&
                statusMutation.mutate({
                  key: statusTarget.meta.key,
                  enabled: false,
                  options: { cascade: true },
                })
              }
            >
              {t('Cascade disable channels')}
            </Button>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  )
}

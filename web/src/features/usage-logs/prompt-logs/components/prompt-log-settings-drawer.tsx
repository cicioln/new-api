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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'

import {
  cleanupPromptLogs,
  toggleChannelPromptLog,
  updatePromptLogSettings,
} from '../api'
import type { PromptLogSettingsResponse } from '../types'

interface PromptLogSettingsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings?: PromptLogSettingsResponse
}

export function PromptLogSettingsDrawer({
  open,
  onOpenChange,
  settings,
}: PromptLogSettingsDrawerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [channelQuery, setChannelQuery] = useState('')
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [retentionDays, setRetentionDays] = useState(7)
  const [maxTextBytes, setMaxTextBytes] = useState(65536)
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(20)
  const [cleanupDays, setCleanupDays] = useState(7)
  const [confirmCleanupAll, setConfirmCleanupAll] = useState(false)
  const [togglingChannelId, setTogglingChannelId] = useState<number | null>(
    null
  )

  useEffect(() => {
    if (!settings?.global) return
    setGlobalEnabled(settings.global.enabled)
    setRetentionDays(settings.global.retention_days)
    setMaxTextBytes(settings.global.max_text_bytes)
    setMaxFileSizeMB(settings.global.max_file_size_mb)
  }, [settings])

  const filteredChannels = useMemo(() => {
    const list = settings?.channels ?? []
    const q = channelQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) || String(ch.id).includes(q)
    )
  }, [channelQuery, settings?.channels])

  const saveGlobalMutation = useMutation({
    mutationFn: () =>
      updatePromptLogSettings({
        enabled: globalEnabled,
        retention_days: Math.max(0, Math.min(3650, Number(retentionDays) || 0)),
        max_text_bytes: Math.max(
          1024,
          Math.min(1048576, Number(maxTextBytes) || 65536)
        ),
        max_file_size_mb: Math.max(
          1,
          Math.min(200, Number(maxFileSizeMB) || 20)
        ),
      }),
    onSuccess: () => {
      toast.success(t('Prompt log settings updated'))
      queryClient.invalidateQueries({ queryKey: ['prompt-log-settings'] })
    },
    onError: (err) => handleServerError(err, t('Failed to update settings')),
  })

  const toggleChannelMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      toggleChannelPromptLog(id, enabled),
    onMutate: ({ id }) => {
      setTogglingChannelId(id)
    },
    onSuccess: () => {
      toast.success(t('Channel prompt logging switch updated'))
      queryClient.invalidateQueries({ queryKey: ['prompt-log-settings'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (err) =>
      handleServerError(err, t('Failed to update channel setting')),
    onSettled: () => {
      setTogglingChannelId(null)
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: (params: { days?: number; all?: boolean }) =>
      cleanupPromptLogs(params),
    onSuccess: (res) => {
      toast.success(
        t('Cleaned up {{count}} prompt log record(s)', { count: res.deleted })
      )
      setConfirmCleanupAll(false)
      queryClient.invalidateQueries({ queryKey: ['prompt-logs'] })
    },
    onError: (err) =>
      handleServerError(err, t('Failed to clean up prompt logs')),
  })

  const enabledCount = useMemo(
    () =>
      (settings?.channels ?? []).filter((ch) => ch.prompt_log_enabled).length,
    [settings?.channels]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='flex w-full flex-col gap-0 p-0 sm:max-w-xl'>
          <SheetHeader className='border-b px-6 py-4'>
            <SheetTitle className='flex items-center gap-2'>
              <Settings2 className='size-4' />
              {t('Prompt Extraction Switches & Retention')}
            </SheetTitle>
            <SheetDescription>
              {t(
                'Control the global prompt capture master switch, choose which channels record user prompts and files, and clean up old records.'
              )}
            </SheetDescription>
          </SheetHeader>

          <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5'>
            <div className='space-y-6'>
              <section className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm font-semibold'>
                    {t('Global Master Switch & Limits')}
                  </h3>
                  {!settings?.can_manage_global && (
                    <Badge variant='outline'>
                      {t('Super Admin only')}
                    </Badge>
                  )}
                </div>

                <div className='bg-muted/25 space-y-4 rounded-lg border p-4'>
                  <div className='flex items-center justify-between gap-4'>
                    <div className='space-y-0.5'>
                      <Label>{t('Enable global channel prompt capture')}</Label>
                      <p className='text-muted-foreground text-xs'>
                        {t(
                          'When off, prompt extraction is paused across all channels regardless of channel-level switches.'
                        )}
                      </p>
                    </div>
                    <Switch
                      disabled={!settings?.can_manage_global}
                      checked={globalEnabled}
                      onCheckedChange={setGlobalEnabled}
                    />
                  </div>

                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>
                        {t('Retention (days)')}
                      </Label>
                      <Input
                        type='number'
                        min={0}
                        max={3650}
                        disabled={!settings?.can_manage_global}
                        value={retentionDays}
                        onChange={(e) =>
                          setRetentionDays(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>
                        {t('Max text (bytes)')}
                      </Label>
                      <Input
                        type='number'
                        min={1024}
                        max={1048576}
                        step={1024}
                        disabled={!settings?.can_manage_global}
                        value={maxTextBytes}
                        onChange={(e) =>
                          setMaxTextBytes(Number(e.target.value))
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label className='text-xs'>{t('Max file (MB)')}</Label>
                      <Input
                        type='number'
                        min={1}
                        max={200}
                        disabled={!settings?.can_manage_global}
                        value={maxFileSizeMB}
                        onChange={(e) =>
                          setMaxFileSizeMB(Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  {settings?.can_manage_global && (
                    <div className='flex justify-end'>
                      <Button
                        type='button'
                        size='sm'
                        disabled={saveGlobalMutation.isPending}
                        onClick={() => saveGlobalMutation.mutate()}
                      >
                        {saveGlobalMutation.isPending && (
                          <Loader2 className='mr-1.5 size-3.5 animate-spin' />
                        )}
                        {t('Save Global Settings')}
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              <section className='space-y-3'>
                <div className='flex items-center justify-between gap-2'>
                  <div>
                    <h3 className='text-sm font-semibold'>
                      {t('Per-Channel Prompt Capture')}
                    </h3>
                    <p className='text-muted-foreground text-xs'>
                      {t('{{enabled}} / {{total}} channel(s) enabled', {
                        enabled: enabledCount,
                        total: settings?.channels?.length ?? 0,
                      })}
                    </p>
                  </div>
                </div>

                <div className='relative'>
                  <Search className='text-muted-foreground absolute top-2.5 left-2.5 size-4' />
                  <Input
                    value={channelQuery}
                    onChange={(e) => setChannelQuery(e.target.value)}
                    placeholder={t('Filter channels by name or ID...')}
                    className='pl-8'
                  />
                </div>

                <div className='divide-y rounded-lg border'>
                  {filteredChannels.length === 0 ? (
                    <div className='text-muted-foreground p-4 text-center text-xs'>
                      {t('No matching channels')}
                    </div>
                  ) : (
                    filteredChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className='flex items-center justify-between gap-3 px-3.5 py-2.5'
                      >
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='truncate text-sm font-medium'>
                              {channel.name || `Channel #${channel.id}`}
                            </span>
                            <Badge
                              variant='outline'
                              className='h-5 px-1.5 font-mono text-[11px]'
                            >
                              #{channel.id}
                            </Badge>
                            {channel.status !== 1 && (
                              <Badge
                                variant='secondary'
                                className='h-5 px-1.5 text-[11px]'
                              >
                                {t('Disabled')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={channel.prompt_log_enabled}
                          disabled={
                            !settings?.can_manage_channels ||
                            togglingChannelId === channel.id
                          }
                          onCheckedChange={(checked) =>
                            toggleChannelMutation.mutate({
                              id: channel.id,
                              enabled: checked,
                            })
                          }
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <Separator />

              <section className='space-y-3'>
                <h3 className='text-sm font-semibold'>{t('Manual Cleanup')}</h3>
                <div className='bg-muted/25 flex flex-wrap items-end justify-between gap-3 rounded-lg border p-4'>
                  <div className='flex items-end gap-2'>
                    <div className='w-28 space-y-1.5'>
                      <Label className='text-xs'>
                        {t('Older than (days)')}
                      </Label>
                      <Input
                        type='number'
                        min={1}
                        max={3650}
                        value={cleanupDays}
                        onChange={(e) => setCleanupDays(Number(e.target.value))}
                      />
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      disabled={cleanupMutation.isPending || cleanupDays <= 0}
                      onClick={() =>
                        cleanupMutation.mutate({ days: cleanupDays })
                      }
                    >
                      {t('Purge Expired')}
                    </Button>
                  </div>
                  <Button
                    type='button'
                    variant='destructive'
                    size='sm'
                    disabled={cleanupMutation.isPending}
                    onClick={() => setConfirmCleanupAll(true)}
                  >
                    <Trash2 className='mr-1.5 size-3.5' />
                    {t('Delete All')}
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmCleanupAll}
        onOpenChange={setConfirmCleanupAll}
        destructive
        isLoading={cleanupMutation.isPending}
        title={t('Delete all prompt logs?')}
        desc={t(
          'This permanently deletes all extracted prompt logs and stored attachment files from the server.'
        )}
        confirmText={t('Delete All')}
        handleConfirm={() => cleanupMutation.mutate({ all: true })}
      />
    </>
  )
}

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
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Image as ImageIcon,
  Paperclip,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { deletePromptLog, getPromptLogs, getPromptLogSettings } from './api'
import { PromptLogDetailDialog } from './components/prompt-log-detail-dialog'
import { PromptLogSettingsDrawer } from './components/prompt-log-settings-drawer'
import type { PromptLogFilters, PromptLogItem } from './types'

const PAGE_SIZE = 20

export function ChannelPromptLogs() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = !!user && user.role >= ROLE.ADMIN

  const [page, setPage] = useState(1)
  const [channelId, setChannelId] = useState<string>('all')
  const [modelName, setModelName] = useState('')
  const [username, setUsername] = useState('')
  const [requestId, setRequestId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [attachmentFilter, setAttachmentFilter] = useState<
    'all' | 'with_attachments'
  >('all')

  const [appliedFilters, setAppliedFilters] = useState<PromptLogFilters>({})
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PromptLogItem | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['prompt-log-settings'],
    queryFn: getPromptLogSettings,
    enabled: isAdmin,
  })

  const logsQuery = useQuery({
    queryKey: ['prompt-logs', page, PAGE_SIZE, appliedFilters],
    queryFn: () =>
      getPromptLogs({
        p: page,
        page_size: PAGE_SIZE,
        ...appliedFilters,
      }),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePromptLog(id),
    onSuccess: () => {
      toast.success(t('Prompt log deleted'))
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['prompt-logs'] })
    },
    onError: (err) => handleServerError(err, t('Failed to delete prompt log')),
  })

  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault()
    setPage(1)
    setAppliedFilters({
      channel_id: channelId !== 'all' ? Number(channelId) : undefined,
      model_name: modelName.trim() || undefined,
      username: username.trim() || undefined,
      request_id: requestId.trim() || undefined,
      keyword: keyword.trim() || undefined,
      has_attachments:
        attachmentFilter === 'with_attachments' ? true : undefined,
    })
  }

  const handleResetFilters = () => {
    setChannelId('all')
    setModelName('')
    setUsername('')
    setRequestId('')
    setKeyword('')
    setAttachmentFilter('all')
    setPage(1)
    setAppliedFilters({})
  }

  const enabledChannelsCount = useMemo(
    () =>
      (settingsQuery.data?.channels ?? []).filter((c) => c.prompt_log_enabled)
        .length,
    [settingsQuery.data?.channels]
  )

  const items = logsQuery.data?.items ?? []
  const total = logsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (!isAdmin) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Prompt Logs')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Alert variant='destructive'>
            <ShieldAlert className='size-4' />
            <AlertTitle>{t('Access Denied')}</AlertTitle>
            <AlertDescription>
              {t('Only administrators can access channel prompt logs.')}
            </AlertDescription>
          </Alert>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  let tableContent: React.ReactNode
  if (logsQuery.isLoading) {
    tableContent = <LoadingState />
  } else if (logsQuery.isError) {
    tableContent = (
      <ErrorState
        onRetry={() => {
          void logsQuery.refetch()
        }}
      />
    )
  } else if (items.length === 0) {
    tableContent = (
      <EmptyState
        icon={FileText}
        title={t('No prompt logs found')}
        description={t(
          'Enable prompt capture on one or more channels and ensure the global master switch is active.'
        )}
      />
    )
  } else {
    tableContent = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-40'>{t('Time')}</TableHead>
            <TableHead>{t('Channel')}</TableHead>
            <TableHead>{t('User')}</TableHead>
            <TableHead>{t('Model')}</TableHead>
            <TableHead>{t('Prompt Preview')}</TableHead>
            <TableHead className='w-32'>{t('Attachments')}</TableHead>
            <TableHead className='w-28 text-right'>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const imageCount = item.attachments.filter(
              (a) => a.kind === 'image'
            ).length
            const otherCount = item.attachment_count - imageCount
            return (
              <TableRow
                key={item.id}
                className='cursor-pointer'
                onClick={() => {
                  setSelectedLogId(item.id)
                  setDetailOpen(true)
                }}
              >
                <TableCell className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                  {formatTimestamp(item.created_at)}
                </TableCell>
                <TableCell className='whitespace-nowrap'>
                  <Badge variant='outline' className='font-normal'>
                    #{item.channel_id} {item.channel_name || t('Channel')}
                  </Badge>
                </TableCell>
                <TableCell className='text-xs whitespace-nowrap'>
                  <div className='font-medium'>
                    {item.username || `#${item.user_id}`}
                  </div>
                  {item.token_name && (
                    <div className='text-muted-foreground text-[11px]'>
                      {item.token_name}
                    </div>
                  )}
                </TableCell>
                <TableCell className='text-xs whitespace-nowrap'>
                  <div className='font-mono font-medium'>
                    {item.model_name || '-'}
                  </div>
                  <div className='text-muted-foreground font-mono text-[11px]'>
                    {item.endpoint}
                  </div>
                </TableCell>
                <TableCell className='max-w-md'>
                  <p className='line-clamp-2 text-xs break-words'>
                    {item.prompt_preview || '-'}
                  </p>
                </TableCell>
                <TableCell className='whitespace-nowrap'>
                  {item.attachment_count > 0 ? (
                    <div className='flex flex-wrap gap-1'>
                      {imageCount > 0 && (
                        <Badge
                          variant='secondary'
                          className='gap-1 text-[11px]'
                        >
                          <ImageIcon className='size-3' />
                          {imageCount}
                        </Badge>
                      )}
                      {otherCount > 0 && (
                        <Badge
                          variant='secondary'
                          className='gap-1 text-[11px]'
                        >
                          <Paperclip className='size-3' />
                          {otherCount}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className='text-muted-foreground text-xs'>-</span>
                  )}
                </TableCell>
                <TableCell
                  className='text-right whitespace-nowrap'
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className='flex justify-end gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      onClick={() => {
                        setSelectedLogId(item.id)
                        setDetailOpen(true)
                      }}
                      title={t('View details')}
                    >
                      <Eye className='size-3.5' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='text-destructive hover:text-destructive size-7'
                      onClick={() => setDeleteTarget(item)}
                      title={t('Delete')}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Prompt Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(
          'Admin-only archive of extracted user prompts, images, audio, documents, and files from channels with prompt capture enabled.'
        )}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className='mr-1.5 size-4' />
          {t('Switches & Retention')}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={logsQuery.isFetching}
          onClick={() => {
            logsQuery.refetch()
            settingsQuery.refetch()
          }}
        >
          <RefreshCw
            className={`mr-1.5 size-4 ${logsQuery.isFetching ? 'animate-spin' : ''}`}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>

      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-3'>
          {settingsQuery.data && (
            <Alert
              variant={
                settingsQuery.data.global.enabled ? 'default' : 'destructive'
              }
              className='shrink-0 py-2.5'
            >
              <Settings2 className='size-4' />
              <AlertDescription className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span>
                    {settingsQuery.data.global.enabled
                      ? t('Global prompt capture is ON')
                      : t('Global prompt capture is OFF (all channels paused)')}
                  </span>
                  <Badge variant='secondary'>
                    {t('{{count}} channel(s) enabled', {
                      count: enabledChannelsCount,
                    })}
                  </Badge>
                  <Badge variant='outline'>
                    {settingsQuery.data.global.retention_days > 0
                      ? t('Retention: {{days}}d', {
                          days: settingsQuery.data.global.retention_days,
                        })
                      : t('Retention: Forever')}
                  </Badge>
                </div>
                <Button
                  type='button'
                  variant='link'
                  size='sm'
                  className='h-auto p-0 text-xs'
                  onClick={() => setSettingsOpen(true)}
                >
                  {t('Configure switches')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleApplyFilters}
            className='bg-card grid shrink-0 grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6'
          >
            <Select
              value={channelId}
              onValueChange={(value) => setChannelId(value ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('All channels')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('All channels')}</SelectItem>
                {(settingsQuery.data?.channels ?? []).map((ch) => (
                  <SelectItem key={ch.id} value={String(ch.id)}>
                    #{ch.id} {ch.name}{' '}
                    {ch.prompt_log_enabled ? `(${t('ON')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={t('Model name')}
            />
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('Username')}
            />
            <Input
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder={t('Request ID')}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('Search prompt keyword...')}
            />

            <div className='flex items-center gap-2'>
              <Select
                value={attachmentFilter}
                onValueChange={(v) =>
                  setAttachmentFilter(v as 'all' | 'with_attachments')
                }
              >
                <SelectTrigger className='flex-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>{t('All requests')}</SelectItem>
                  <SelectItem value='with_attachments'>
                    {t('With files / images')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button type='submit' size='sm' className='shrink-0'>
                <Search className='mr-1 size-3.5' />
                {t('Search')}
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='shrink-0'
                onClick={handleResetFilters}
              >
                {t('Reset')}
              </Button>
            </div>
          </form>

          <div className='bg-card min-h-0 flex-1 overflow-auto rounded-lg border'>
            {tableContent}
          </div>

          <div className='flex shrink-0 items-center justify-between text-xs'>
            <span className='text-muted-foreground'>
              {t('Total: {{total}}', { total })}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className='size-4' />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>

          <PromptLogDetailDialog
            logId={selectedLogId}
            open={detailOpen}
            onOpenChange={setDetailOpen}
          />

          <PromptLogSettingsDrawer
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            settings={settingsQuery.data}
          />

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
            destructive
            isLoading={deleteMutation.isPending}
            title={t('Delete prompt log?')}
            desc={t(
              'This removes the extracted prompt record and deletes its stored attachment files.'
            )}
            confirmText={t('Delete')}
            handleConfirm={() => {
              if (deleteTarget) {
                deleteMutation.mutate(deleteTarget.id)
              }
            }}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

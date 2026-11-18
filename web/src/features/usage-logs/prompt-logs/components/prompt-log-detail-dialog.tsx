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
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, FileText, Loader2, Paperclip } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatTimestamp } from '@/lib/format'

import { getPromptLogDetail } from '../api'
import { PromptAttachmentCard } from './prompt-attachment-card'

interface PromptLogDetailDialogProps {
  logId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptLogDetailDialog({
  logId,
  open,
  onOpenChange,
}: PromptLogDetailDialogProps) {
  const { t } = useTranslation()

  const detailQuery = useQuery({
    queryKey: ['prompt-log-detail', logId],
    queryFn: () => getPromptLogDetail(logId as number),
    enabled: open && logId !== null && logId > 0,
  })

  const detail = detailQuery.data

  const formattedMetadata = useMemo(() => {
    if (!detail?.metadata_json) return ''
    try {
      return JSON.stringify(JSON.parse(detail.metadata_json), null, 2)
    } catch {
      return detail.metadata_json
    }
  }, [detail?.metadata_json])

  const renderBody = () => {
    if (detailQuery.isLoading) {
      return (
        <div className='text-muted-foreground flex h-48 items-center justify-center gap-2 text-sm'>
          <Loader2 className='size-4 animate-spin' />
          {t('Loading...')}
        </div>
      )
    }
    if (detailQuery.isError) {
      return (
        <Alert variant='destructive'>
          <AlertTriangle className='size-4' />
          <AlertDescription>
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : t('Failed to load prompt log details')}
          </AlertDescription>
        </Alert>
      )
    }
    if (!detail) {
      return null
    }
    return (
      <div className='space-y-5'>
        <div className='bg-muted/30 grid grid-cols-1 gap-3 rounded-lg border p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3'>
          <div>
            <span className='text-muted-foreground block'>{t('Channel')}</span>
            <span className='font-medium'>
              {detail.channel_name || '-'} (ID: {detail.channel_id})
            </span>
          </div>
          <div>
            <span className='text-muted-foreground block'>
              {t('User / Token')}
            </span>
            <span className='font-medium'>
              {detail.username || `#${detail.user_id || 0}`}
              {detail.token_name ? ` · ${detail.token_name}` : ''}
            </span>
          </div>
          <div>
            <span className='text-muted-foreground block'>{t('Model')}</span>
            <span className='font-mono font-medium'>
              {detail.model_name || '-'}
            </span>
          </div>
          <div>
            <span className='text-muted-foreground block'>
              {t('Endpoint / Format')}
            </span>
            <span className='font-mono'>
              {detail.endpoint || '-'}
              {detail.relay_format ? ` (${detail.relay_format})` : ''}
            </span>
          </div>
          <div>
            <span className='text-muted-foreground block'>{t('Time')}</span>
            <span>{formatTimestamp(detail.created_at)}</span>
          </div>
          <div>
            <span className='text-muted-foreground block'>
              {t('Request ID')}
            </span>
            <div className='flex items-center gap-1'>
              <span className='truncate font-mono'>
                {detail.request_id || '-'}
              </span>
              {detail.request_id && (
                <CopyButton
                  value={detail.request_id}
                  size='icon'
                  variant='ghost'
                  className='size-6'
                />
              )}
            </div>
          </div>
        </div>

        {detail.prompt_truncated && (
          <Alert>
            <AlertTriangle className='size-4' />
            <AlertDescription>
              {t(
                'This extracted prompt exceeded the configured byte limit and was truncated.'
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-semibold'>{t('Extracted Prompt')}</h4>
            {detail.prompt_text && (
              <CopyButton value={detail.prompt_text} variant='outline' size='sm'>
                <span className='ml-1 text-xs'>{t('Copy')}</span>
              </CopyButton>
            )}
          </div>
          <pre className='bg-muted/30 max-h-[380px] overflow-auto rounded-lg border p-3.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap'>
            {detail.prompt_text || t('No text content extracted')}
          </pre>
        </div>

        {detail.attachments && detail.attachments.length > 0 && (
          <>
            <Separator />
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Paperclip className='size-4' />
                <h4 className='text-sm font-semibold'>
                  {t('Attachments')} ({detail.attachments.length})
                </h4>
              </div>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {detail.attachments.map((att) => (
                  <PromptAttachmentCard key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          </>
        )}

        {formattedMetadata && (
          <>
            <Separator />
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <h4 className='text-sm font-semibold'>
                  {t('Request Parameters')}
                </h4>
                <CopyButton
                  value={formattedMetadata}
                  variant='ghost'
                  size='sm'
                >
                  <span className='ml-1 text-xs'>{t('Copy')}</span>
                </CopyButton>
              </div>
              <pre className='bg-muted/30 max-h-56 overflow-auto rounded-lg border p-3 font-mono text-xs break-words whitespace-pre-wrap'>
                {formattedMetadata}
              </pre>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-4xl'>
        <DialogHeader className='border-b px-6 py-4'>
          <DialogTitle className='flex items-center gap-2'>
            <FileText className='size-4' />
            <span>{t('Prompt Log Details')}</span>
            {detail && (
              <Badge variant='secondary' className='font-mono text-xs'>
                #{detail.id}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.channel_name || `#${detail.channel_id}`} · ${detail.model_name || '-'} · ${formatTimestamp(detail.created_at)}`
              : t('Inspect extracted user prompts, metadata, and attachments')}
          </DialogDescription>
        </DialogHeader>

        <div className='min-h-0 flex-1 overflow-y-auto px-6 py-4'>
          {renderBody()}
        </div>
      </DialogContent>
    </Dialog>
  )
}

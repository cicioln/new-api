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
import {
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  FileVideo,
  File as FileIcon,
  Image as ImageIcon,
  Loader2,
  Maximize2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { downloadPromptAttachmentFile, fetchPromptAttachmentBlob } from '../api'
import type { PromptLogAttachment } from '../types'

function formatAttachmentBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function AttachmentKindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'image':
      return <ImageIcon className='size-4 shrink-0 text-sky-500' />
    case 'audio':
      return <FileAudio className='size-4 shrink-0 text-violet-500' />
    case 'video':
      return <FileVideo className='size-4 shrink-0 text-amber-500' />
    case 'document':
      return <FileText className='size-4 shrink-0 text-emerald-500' />
    default:
      return <FileIcon className='text-muted-foreground size-4 shrink-0' />
  }
}

function canInlinePreviewBlob(att: PromptLogAttachment): boolean {
  if (!att.has_file || !att.download_url) return false
  const mime = (att.mime_type || '').toLowerCase()
  if (mime === 'image/svg+xml' || mime === 'text/html') return false
  return (
    mime.startsWith('image/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime === 'application/json'
  )
}

export function PromptAttachmentCard({
  attachment,
}: {
  attachment: PromptLogAttachment
}) {
  const { t } = useTranslation()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)

  const previewable = canInlinePreviewBlob(attachment)
  const mime = (attachment.mime_type || '').toLowerCase()

  useEffect(() => {
    if (!previewable || !attachment.download_url) {
      return
    }
    const downloadUrl = attachment.download_url
    let active = true
    let createdUrl: string | null = null
    const controller = new AbortController()

    async function loadPreview() {
      setLoadingPreview(true)
      setPreviewError(false)
      setTextPreview(null)
      try {
        const blob = await fetchPromptAttachmentBlob(
          downloadUrl,
          controller.signal
        )
        if (!active) return
        if (mime.startsWith('text/') || mime === 'application/json') {
          const text = await blob.slice(0, 16384).text()
          if (active) setTextPreview(text)
        }
        createdUrl = URL.createObjectURL(blob)
        if (active) {
          setBlobUrl(createdUrl)
        } else {
          URL.revokeObjectURL(createdUrl)
        }
      } catch {
        if (!active || controller.signal.aborted) return
        setPreviewError(true)
      } finally {
        if (active) setLoadingPreview(false)
      }
    }

    void loadPreview()

    return () => {
      active = false
      controller.abort()
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
      setBlobUrl(null)
    }
  }, [attachment.download_url, mime, previewable])

  const handleDownload = async () => {
    if (!attachment.download_url) return
    setDownloading(true)
    try {
      await downloadPromptAttachmentFile(
        attachment.download_url,
        attachment.file_name || attachment.id
      )
      toast.success(t('Attachment downloaded'))
    } catch (err) {
      handleServerError(err, t('Failed to download attachment'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className='bg-muted/25 flex flex-col gap-2.5 rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <AttachmentKindIcon kind={attachment.kind} />
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {attachment.file_name || attachment.field_name || attachment.id}
            </div>
            <div className='text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs'>
              <Badge variant='outline' className='h-5 px-1.5 text-[11px]'>
                {attachment.kind}
              </Badge>
              {attachment.mime_type && <span>{attachment.mime_type}</span>}
              {attachment.size_bytes ? (
                <span>· {formatAttachmentBytes(attachment.size_bytes)}</span>
              ) : null}
              {attachment.field_name && (
                <span>· {attachment.field_name}</span>
              )}
            </div>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          {mime.startsWith('image/') && blobUrl && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-7'
              onClick={() => setZoomOpen(true)}
              title={t('Preview image')}
            >
              <Maximize2 className='size-3.5' />
            </Button>
          )}
          {attachment.has_file && attachment.download_url && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : (
                <Download className='size-3.5' />
              )}
              {t('Download')}
            </Button>
          )}
          {attachment.external_url &&
            (attachment.external_url.startsWith('https://') ||
              attachment.external_url.startsWith('http://')) && (
              <a
                href={attachment.external_url}
                target='_blank'
                rel='noopener noreferrer'
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                  className: 'h-7 gap-1 px-2 text-xs',
                })}
              >
                <ExternalLink className='size-3.5' />
                {t('Open URL')}
              </a>
            )}
        </div>
      </div>

      {attachment.error && (
        <div className='text-destructive text-xs'>{attachment.error}</div>
      )}

      {attachment.external_url && !attachment.has_file && (
        <div className='text-muted-foreground bg-background rounded border px-2.5 py-1.5 font-mono text-xs break-all'>
          {attachment.external_url}
        </div>
      )}

      {loadingPreview && (
        <div className='text-muted-foreground flex h-24 items-center justify-center gap-2 text-xs'>
          <Loader2 className='size-4 animate-spin' />
          {t('Loading preview...')}
        </div>
      )}

      {previewError && (
        <div className='text-muted-foreground text-xs'>
          {t('Preview unavailable')}
        </div>
      )}

      {blobUrl && mime.startsWith('image/') && (
        <button
          type='button'
          onClick={() => setZoomOpen(true)}
          className='bg-background/70 group relative flex max-h-60 w-full items-center justify-center overflow-hidden rounded-md border p-1'
        >
          <img
            src={blobUrl}
            alt={attachment.file_name || attachment.id}
            className='max-h-56 w-auto rounded object-contain transition-transform group-hover:scale-[1.01]'
          />
        </button>
      )}

      {blobUrl && mime.startsWith('audio/') && (
        <audio src={blobUrl} controls className='w-full' />
      )}

      {blobUrl && mime.startsWith('video/') && (
        <video
          src={blobUrl}
          controls
          className='max-h-64 w-full rounded-md bg-black'
        />
      )}

      {blobUrl && mime === 'application/pdf' && (
        <iframe
          src={blobUrl}
          title={attachment.file_name || attachment.id}
          sandbox=''
          className='h-64 w-full rounded-md border bg-white'
        />
      )}

      {textPreview !== null && (
        <pre className='bg-background max-h-48 overflow-auto rounded-md border p-2 font-mono text-xs break-words whitespace-pre-wrap'>
          {textPreview}
        </pre>
      )}

      {attachment.sha256 && (
        <div className='text-muted-foreground truncate font-mono text-[11px]'>
          SHA-256: {attachment.sha256}
        </div>
      )}

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{attachment.file_name || attachment.id}</DialogTitle>
          </DialogHeader>
          {blobUrl && (
            <div className='flex max-h-[80vh] items-center justify-center overflow-auto'>
              <img
                src={blobUrl}
                alt={attachment.file_name || attachment.id}
                className='max-h-[75vh] w-auto rounded object-contain'
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

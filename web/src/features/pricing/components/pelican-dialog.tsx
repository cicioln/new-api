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
import { Link } from '@tanstack/react-router'
import { ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  createPelicanRecord,
  deletePelicanRecord,
  getPelicanRecords,
} from '../api'
import {
  formatMarketLatency,
  getVendorAvatarIcon,
  getVendorAvatarName,
} from '../lib/market'
import {
  extractSvg,
  PELICAN_PROMPT,
  svgDataUrl,
  type PelicanRecord,
} from '../lib/pelican'
import type { PricingModel } from '../types'
import { VendorAvatar } from './market-parts'
import { MarketSeg } from './market-seg'

export interface PelicanDialogProps {
  model: PricingModel | null
  groups: string[]
  defaultGroup?: string
  onOpenChange: (open: boolean) => void
}

type Scope = 'model' | 'all'

const PELICAN_QUERY_KEY = ['pelican-records']

function useTimeAgo() {
  const { t } = useTranslation()
  return (ts: number) => {
    const minutes = Math.floor((Date.now() - ts) / 60000)
    if (minutes < 1) return t('Just now')
    if (minutes < 60) return t('{{count}} minutes ago', { count: minutes })
    if (minutes < 1440) {
      return t('{{count}} hours ago', { count: Math.floor(minutes / 60) })
    }
    return t('{{count}} days ago', { count: Math.floor(minutes / 1440) })
  }
}

function Thumbs(props: {
  records: PelicanRecord[]
  selected?: PelicanRecord
  onSelect: (record: PelicanRecord) => void
  className?: string
}) {
  const { t } = useTranslation()
  const ago = useTimeAgo()
  return (
    <div className={cn('grid grid-cols-3 gap-1.5', props.className)}>
      {props.records.map((record) => (
        <button
          key={record.id}
          type='button'
          title={record.model}
          onClick={() => props.onSelect(record)}
          className={cn(
            'bg-background min-w-0 rounded-[7px] border p-[3px] text-left',
            record.id === props.selected?.id && 'border-primary'
          )}
        >
          <img
            src={svgDataUrl(record.svg)}
            alt={record.model}
            className='bg-muted block aspect-[4/3] w-full rounded object-contain'
          />
          <small className='text-subtle-foreground block truncate px-0.5 pt-0.5 font-mono text-[10px]'>
            {record.mine ? t('Me') : record.username}
          </small>
          <small className='text-subtle-foreground block truncate px-0.5 font-mono text-[10px]'>
            {ago(record.createdAt)}
          </small>
        </button>
      ))}
    </div>
  )
}

function PelicanContent(props: PelicanDialogProps & { model: PricingModel }) {
  const { t } = useTranslation()
  const ago = useTimeAgo()
  const user = useAuthStore((state) => state.auth.user)
  const isAuthenticated = Boolean(user)
  const isAdmin = (user?.role ?? 0) >= ROLE.ADMIN
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()
  const queryClient = useQueryClient()
  const historyQuery = useQuery({
    queryKey: PELICAN_QUERY_KEY,
    queryFn: getPelicanRecords,
  })
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data])
  const saveRecord = useMutation({
    mutationFn: createPelicanRecord,
    onSuccess: (record) => {
      queryClient.setQueryData<PelicanRecord[]>(PELICAN_QUERY_KEY, (prev) => [
        record,
        ...(prev ?? []),
      ])
      setScope('model')
      setView('img')
      select(record)
      toast.success(t('Test complete, added to the test records'))
    },
    onError: (error) => toast.error(error.message),
  })
  const removeRecord = useMutation({
    mutationFn: deletePelicanRecord,
    onSuccess: (_, id) => {
      queryClient.setQueryData<PelicanRecord[]>(PELICAN_QUERY_KEY, (prev) =>
        (prev ?? []).filter((record) => record.id !== id)
      )
      setSelectedId(undefined)
      toast.success(t('Deleted successfully'))
    },
    onError: (error) => toast.error(error.message),
  })
  const [scope, setScope] = useState<Scope>('model')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'img' | 'code'>('img')
  const [prompt, setPrompt] = useState(PELICAN_PROMPT)
  const modelGroups = props.groups.filter((group) =>
    props.model.enable_groups?.includes(group)
  )
  const [group, setGroup] = useState(
    props.defaultGroup && modelGroups.includes(props.defaultGroup)
      ? props.defaultGroup
      : (modelGroups[0] ?? '')
  )
  const [stream, setStream] = useState('')
  const preRef = useRef<HTMLPreElement>(null)

  const mine = useMemo(
    () => history.filter((record) => record.model === props.model.model_name),
    [history, props.model.model_name]
  )
  const [selectedId, setSelectedId] = useState<number | undefined>()
  // Until the viewer picks a mode, open on the runner only when this model
  // has no records yet.
  const [pickedMode, setMode] = useState<'run' | 'view'>()
  const hasRecords = mine.length > 0 || historyQuery.isPending
  const mode = pickedMode ?? (hasRecords ? 'view' : 'run')
  const list = scope === 'all' ? history : mine
  const selected =
    mode === 'view'
      ? (history.find((record) => record.id === selectedId) ?? list[0])
      : undefined

  useEffect(() => () => stopStream(), [stopStream])
  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight
  }, [stream])

  const byModel = useMemo(() => {
    const map = new Map<string, PelicanRecord[]>()
    for (const record of history) {
      map.set(record.model, [...(map.get(record.model) ?? []), record])
    }
    return [...map.entries()]
  }, [history])

  const select = (record: PelicanRecord) => {
    setSelectedId(record.id)
    setMode('view')
  }

  const run = () => {
    const started = performance.now()
    let firstTokenMs: number | undefined
    let content = ''
    let outputTokens: number | undefined
    setStream('')
    void sendStreamRequest(
      {
        model: props.model.model_name,
        group: group || undefined,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      },
      {
        onUpdate: (type, chunk) => {
          if (type !== 'content') return
          firstTokenMs ??= performance.now() - started
          content += chunk
          setStream(content)
        },
        onUsage: (usage) => {
          outputTokens = usage.completion_tokens
        },
        onComplete: () => {
          const svg = extractSvg(content)
          if (!svg) {
            toast.error(t('The model did not return an SVG'))
            return
          }
          saveRecord.mutate({
            model: props.model.model_name,
            vendor: props.model.vendor_name,
            prompt,
            group,
            svg,
            firstTokenMs:
              firstTokenMs === undefined ? undefined : Math.round(firstTokenMs),
            totalMs: performance.now() - started,
            outputTokens,
          })
        },
        onError: (error) => toast.error(error),
      }
    )
  }

  const copySvg = () => {
    if (!selected) return
    void navigator.clipboard
      .writeText(selected.svg)
      .then(() => toast.success(t('SVG source copied')))
      .catch(() => toast.error(t('Copy failed')))
  }

  const downloadSvg = () => {
    if (!selected) return
    const url = URL.createObjectURL(
      new Blob([selected.svg], { type: 'image/svg+xml' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `${selected.model}-pelican.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  const users = new Set(mine.map((record) => record.username)).size
  const fieldClass =
    'bg-background w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none disabled:opacity-60'

  let right: React.ReactNode = null
  if (mode === 'run') {
    right = (
      <>
        <h5 className='text-subtle-foreground flex min-h-[34px] items-center justify-between text-xs font-medium'>
          <span>
            {t('My test')} · {props.model.model_name}
          </span>
          {mine.length > 0 && !isStreaming && !saveRecord.isPending && (
            <Button size='sm' variant='outline' onClick={() => setMode('view')}>
              {t('Back to records')}
            </Button>
          )}
        </h5>
        <div className='flex flex-col gap-3'>
          <div>
            <label
              htmlFor='pelican-prompt'
              className='text-subtle-foreground mb-1.5 block text-xs'
            >
              {t('Test prompt')}
            </label>
            <textarea
              id='pelican-prompt'
              value={prompt}
              disabled={isStreaming}
              onChange={(event) => setPrompt(event.target.value)}
              className={cn(fieldClass, 'h-[92px] resize-y leading-normal')}
            />
          </div>
          <div className='grid grid-cols-2 gap-2.5'>
            <div>
              <label
                htmlFor='pelican-group'
                className='text-subtle-foreground mb-1.5 block text-xs'
              >
                {t('Billing group')}
              </label>
              <select
                id='pelican-group'
                value={group}
                disabled={isStreaming}
                onChange={(event) => setGroup(event.target.value)}
                className={fieldClass}
              >
                {modelGroups.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='pelican-key'
                className='text-subtle-foreground mb-1.5 block text-xs'
              >
                {t('Use key')}
              </label>
              <select id='pelican-key' disabled className={fieldClass}>
                <option>{t('Current session')}</option>
              </select>
            </div>
          </div>
          {isAuthenticated ? (
            <Button
              className='w-full'
              disabled={isStreaming || saveRecord.isPending || !prompt.trim()}
              onClick={run}
            >
              {isStreaming ? t('Generating…') : t('Start test')}
            </Button>
          ) : (
            <Button className='w-full' render={<Link to='/sign-in' />}>
              {t('Sign in to run a test')}
            </Button>
          )}
          <p className='text-subtle-foreground text-xs leading-relaxed'>
            {t(
              'Each test is a real call billed at the selected group price, and appears in the usage logs.'
            )}
          </p>
        </div>
        <div className='bg-muted relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[10px] border'>
          {isStreaming ? (
            <>
              <pre
                ref={preRef}
                className='bg-card text-muted-foreground absolute inset-0 m-0 overflow-auto p-3.5 font-mono text-[11.5px] leading-[1.55] break-all whitespace-pre-wrap'
              >
                {stream}
              </pre>
              <span className='bg-card text-primary absolute top-2.5 right-2.5 rounded-full border px-2 py-0.5 text-xs'>
                {t('Generating…')}
              </span>
            </>
          ) : (
            <div className='text-subtle-foreground text-center text-[13px] leading-[1.7]'>
              {t('Use {{model}} to draw a pelican riding a bicycle', {
                model: props.model.model_name,
              })}
              <br />
              {t('The result will be added to the test records on the left')}
            </div>
          )}
        </div>
      </>
    )
  } else if (selected) {
    const author = selected.mine ? t('Me') : selected.username
    right = (
      <>
        <h5 className='text-subtle-foreground flex min-h-[34px] items-center justify-between text-xs font-medium'>
          <span className='text-muted-foreground flex items-center gap-2'>
            <i className='bg-primary grid size-[22px] place-items-center rounded-full text-[11px] text-white not-italic'>
              {author.charAt(0).toUpperCase()}
            </i>
            {author}
            {selected.mine && (
              <span className='border-primary text-primary rounded-full border px-1.5 text-[10px]'>
                {t('Mine')}
              </span>
            )}
            · {ago(selected.createdAt)}
          </span>
          <MarketSeg
            value={view}
            onChange={setView}
            aria-label={t('View')}
            options={[
              { value: 'img', label: t('Render') },
              { value: 'code', label: t('SVG source') },
            ]}
          />
        </h5>
        <div className='bg-muted relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[10px] border'>
          {view === 'code' ? (
            <pre className='bg-card text-muted-foreground absolute inset-0 m-0 overflow-auto p-3.5 font-mono text-[11.5px] leading-[1.55] break-all whitespace-pre-wrap'>
              {selected.svg}
            </pre>
          ) : (
            <img
              src={svgDataUrl(selected.svg)}
              alt={t('Pelican riding a bicycle by {{model}}', {
                model: selected.model,
              })}
              className='block size-full object-contain'
            />
          )}
        </div>
        <div className='bg-muted text-muted-foreground rounded-lg px-2.5 py-2 text-xs leading-relaxed'>
          <span className='text-subtle-foreground'>{t('Test prompt')}: </span>
          {selected.prompt}
        </div>
        <div className='bg-muted grid grid-cols-4 rounded-lg px-3 py-2.5 max-[720px]:grid-cols-2 max-[720px]:gap-2'>
          {[
            [t('First token'), formatMarketLatency(selected.firstTokenMs)],
            [t('Total time'), `${(selected.totalMs / 1000).toFixed(1)}s`],
            [t('Output tokens'), selected.outputTokens ?? '—'],
            [t('Group'), selected.group || '—'],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={cn(
                index > 0 && 'border-l pl-3',
                index === 2 && 'max-[720px]:border-l-0 max-[720px]:pl-0'
              )}
            >
              <small className='text-subtle-foreground block text-[11px]'>
                {label}
              </small>
              <b className='font-mono text-[13px] font-medium'>{value}</b>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className='flex items-center gap-3 border-b px-5 py-4'>
        <VendorAvatar
          name={getVendorAvatarName(props.model)}
          icon={getVendorAvatarIcon(props.model)}
        />
        <div className='min-w-0'>
          <DialogTitle className='font-mono text-[15px] font-medium'>
            {props.model.model_name}
          </DialogTitle>
          <small className='text-subtle-foreground mt-0.5 block text-xs'>
            {t(
              'Pelican test · {{count}} tests from {{users}} users · the model outputs SVG code that is rendered here',
              { count: mine.length, users }
            )}
          </small>
        </div>
        <button
          type='button'
          aria-label={t('Close')}
          onClick={() => props.onOpenChange(false)}
          className='hover:bg-muted ml-auto grid size-8 shrink-0 place-items-center rounded-[7px]'
        >
          <X className='text-muted-foreground size-4' />
        </button>
      </div>
      <div className='grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-auto max-[720px]:grid-cols-1'>
        <div className='flex min-h-0 flex-col gap-3 border-r px-5 py-4 max-[720px]:border-r-0 max-[720px]:border-b'>
          <div className='flex items-center justify-between gap-2'>
            <MarketSeg
              value={scope}
              onChange={setScope}
              aria-label={t('Test records')}
              options={[
                {
                  value: 'model',
                  label: `${t('This model')} · ${mine.length}`,
                },
                {
                  value: 'all',
                  label: `${t('All models')} · ${history.length}`,
                },
              ]}
            />
            <small className='text-subtle-foreground text-xs'>
              {t('By time')}
            </small>
          </div>
          <div className='-mx-1 max-h-[440px] overflow-auto px-1'>
            {list.length === 0 && (
              <p className='text-subtle-foreground py-8 text-center text-xs'>
                {t('No test records yet')}
              </p>
            )}
            {scope === 'model' && (
              <Thumbs records={mine} selected={selected} onSelect={select} />
            )}
            {scope === 'all' && (
              <div className='flex flex-col gap-1.5'>
                {byModel.map(([name, records]) => {
                  const expanded = Boolean(open[name])
                  return (
                    <div
                      key={name}
                      className={cn(
                        'bg-background rounded-lg border',
                        expanded && 'border-input'
                      )}
                    >
                      <button
                        type='button'
                        aria-expanded={expanded}
                        onClick={() =>
                          setOpen((prev) => ({ ...prev, [name]: !prev[name] }))
                        }
                        className='hover:bg-muted flex w-full items-center gap-2 rounded-lg px-2.5 py-[9px] text-left'
                      >
                        <span className='min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold'>
                          {name}
                        </span>
                        <small className='text-subtle-foreground shrink-0 text-[11px]'>
                          {t('{{count}} times', { count: records.length })} ·{' '}
                          {ago(records[0].createdAt)}
                        </small>
                        <ChevronRight
                          className={cn(
                            'text-subtle-foreground size-3.5 shrink-0 transition-transform',
                            expanded && 'rotate-90'
                          )}
                        />
                      </button>
                      {expanded && (
                        <Thumbs
                          records={records}
                          selected={selected}
                          onSelect={select}
                          className='px-2 pb-2'
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <Button
            className='w-full'
            disabled={isStreaming}
            onClick={() => setMode('run')}
          >
            {isStreaming ? t('Generating…') : t('Test it myself')}
          </Button>
        </div>
        <div className='flex min-w-0 flex-col gap-3 px-5 py-[18px]'>
          {right}
        </div>
      </div>
      <div className='flex justify-end gap-2 border-t px-5 py-3'>
        {selected && (selected.mine || isAdmin) && (
          <Button
            variant='outline'
            className='text-destructive me-auto'
            disabled={removeRecord.isPending}
            onClick={() => removeRecord.mutate(selected.id)}
          >
            {t('Delete')}
          </Button>
        )}
        <Button variant='outline' disabled={!selected} onClick={copySvg}>
          {t('Copy SVG')}
        </Button>
        <Button variant='outline' disabled={!selected} onClick={downloadSvg}>
          {t('Download')}
        </Button>
      </div>
    </>
  )
}

export function PelicanDialog(props: PelicanDialogProps) {
  return (
    <Dialog open={Boolean(props.model)} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className='bg-card flex max-h-[calc(100dvh-48px)] w-[min(980px,calc(100%-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-[14px] border p-0 shadow-[var(--shadow-soft)] ring-0 sm:max-w-none'
      >
        {props.model && (
          <PelicanContent
            key={props.model.model_name}
            {...props}
            model={props.model}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

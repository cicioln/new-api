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
import { Bird } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { getPelicanRecords } from '../api'
import { useTimeAgo } from '../hooks/use-time-ago'
import { getVendorAvatar, supportsPelicanTest } from '../lib/market'
import { PELICAN_QUERY_KEY, svgDataUrl } from '../lib/pelican'
import type { PricingModel } from '../types'

export function VendorAvatar(props: {
  name: string
  icon?: string
  className?: string
}) {
  if (props.icon) {
    return (
      <span
        aria-hidden
        className={cn(
          'grid size-[34px] shrink-0 place-items-center',
          props.className
        )}
      >
        {getLobeIcon(props.icon, 20)}
      </span>
    )
  }
  const avatar = getVendorAvatar(props.name)
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[34px] shrink-0 place-items-center rounded-[9px] text-[13px] font-bold text-white',
        props.className
      )}
      style={{ background: avatar.color }}
    >
      {avatar.letter}
    </span>
  )
}

/** Model name with a copy button that appears on row / card hover. */
export function MarketModelName(props: { name: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className='flex min-w-0 items-center gap-0.5'>
      <b
        title={props.name}
        className={cn(
          'min-w-0 truncate font-mono font-medium',
          props.className
        )}
      >
        {props.name}
      </b>
      {/* Copying must not open the model details. */}
      <span onClick={(event) => event.stopPropagation()}>
        <CopyButton
          value={props.name}
          aria-label={t('Copy model name')}
          className='text-subtle-foreground size-[22px] rounded-[5px] opacity-0 transition-opacity group-hover/market:opacity-100 focus-visible:opacity-100'
          iconClassName='size-[13px]'
        />
      </span>
    </div>
  )
}

export function MarketGroupTags(props: {
  groups: string[]
  max: number
  className?: string
}) {
  const { t } = useTranslation()
  const shown =
    props.groups.length > props.max
      ? props.groups.slice(0, props.max - 1)
      : props.groups
  const rest = props.groups.slice(shown.length)
  return (
    <>
      {shown.map((group) => (
        <span
          key={group}
          className={cn(
            'bg-muted text-muted-foreground inline-flex h-[22px] items-center rounded-md px-2 font-mono font-medium whitespace-nowrap',
            props.className
          )}
        >
          {group}
        </span>
      ))}
      {rest.length > 0 && (
        <span
          title={rest.join(', ')}
          aria-label={t('View all {{count}} groups', {
            count: props.groups.length,
          })}
          className={cn(
            'bg-accent text-primary inline-flex h-[22px] cursor-default items-center rounded-md px-2 font-mono font-medium whitespace-nowrap',
            props.className
          )}
        >
          +{rest.length}
        </span>
      )}
    </>
  )
}

const PELICAN_BUTTON_CLASS =
  'bg-card text-muted-foreground hover:border-primary hover:text-primary disabled:hover:text-subtle-foreground disabled:hover:border-border inline-flex h-7 items-center gap-[5px] rounded-[7px] border px-2.5 text-[12.5px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45'

/** Hover preview of the latest pelicans drawn by one model. */
function PelicanPreview(props: { modelName: string }) {
  const { t } = useTranslation()
  const ago = useTimeAgo()
  const query = useQuery({
    queryKey: PELICAN_QUERY_KEY,
    queryFn: getPelicanRecords,
    staleTime: 60_000,
  })
  const records = (query.data ?? [])
    .filter((record) => record.model === props.modelName)
    .slice(0, 4)
  const latest = records[0]

  if (query.isLoading) {
    return (
      <p className='text-subtle-foreground py-6 text-center text-xs'>
        {t('Loading...')}
      </p>
    )
  }
  if (!latest) {
    return (
      <p className='text-subtle-foreground py-6 text-center text-xs'>
        {t('No test records yet')}
      </p>
    )
  }
  return (
    <div className='flex flex-col gap-2'>
      <img
        src={svgDataUrl(latest.svg)}
        alt={t('Pelican riding a bicycle by {{model}}', {
          model: latest.model,
        })}
        className='bg-muted block aspect-[4/3] w-full rounded-md object-contain'
      />
      <div className='text-subtle-foreground flex justify-between gap-2 font-mono text-[11px]'>
        <span className='truncate'>
          {latest.mine ? t('Me') : latest.username}
        </span>
        <span className='shrink-0'>{ago(latest.createdAt)}</span>
      </div>
      {records.length > 1 && (
        <div className='grid grid-cols-3 gap-1.5'>
          {records.slice(1).map((record) => (
            <img
              key={record.id}
              src={svgDataUrl(record.svg)}
              alt={t('Pelican riding a bicycle by {{model}}', {
                model: record.model,
              })}
              className='bg-muted block aspect-[4/3] w-full rounded object-contain'
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PelicanButton(props: {
  model: PricingModel
  onTest: (modelName: string) => void
}) {
  const { t } = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)
  const supported = supportsPelicanTest(props.model)
  const label = (
    <>
      <Bird aria-hidden className='size-3.5' strokeWidth={1.8} />
      {t('Pelican test')}
    </>
  )

  if (!supported) {
    return (
      <button
        type='button'
        disabled
        title={t('Embedding models do not support generation tests')}
        className={PELICAN_BUTTON_CLASS}
      >
        {label}
      </button>
    )
  }

  return (
    <HoverCard open={previewOpen} onOpenChange={setPreviewOpen}>
      <HoverCardTrigger
        delay={300}
        render={
          <button
            type='button'
            title={t('Ask the model to draw a pelican riding a bicycle')}
            onClick={(event) => {
              event.stopPropagation()
              setPreviewOpen(false)
              props.onTest(props.model.model_name)
            }}
            className={PELICAN_BUTTON_CLASS}
          />
        }
      >
        {label}
      </HoverCardTrigger>
      <HoverCardContent side='top' className='w-60'>
        {previewOpen && <PelicanPreview modelName={props.model.model_name} />}
      </HoverCardContent>
    </HoverCard>
  )
}

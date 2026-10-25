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
import { Bird } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

import { getVendorAvatar, supportsPelicanTest } from '../lib/market'
import type { PricingModel } from '../types'

export function VendorAvatar(props: { name: string; className?: string }) {
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

export function PelicanButton(props: {
  model: PricingModel
  onTest: (modelName: string) => void
}) {
  const { t } = useTranslation()
  const supported = supportsPelicanTest(props.model)
  return (
    <button
      type='button'
      disabled={!supported}
      title={
        supported
          ? t('Ask the model to draw a pelican riding a bicycle')
          : t('Embedding models do not support generation tests')
      }
      onClick={(event) => {
        event.stopPropagation()
        props.onTest(props.model.model_name)
      }}
      className='bg-card text-muted-foreground hover:border-primary hover:text-primary disabled:hover:text-subtle-foreground disabled:hover:border-border inline-flex h-7 items-center gap-[5px] rounded-[7px] border px-2.5 text-[12.5px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45'
    >
      <Bird aria-hidden className='size-3.5' strokeWidth={1.8} />
      {t('Pelican test')}
    </button>
  )
}

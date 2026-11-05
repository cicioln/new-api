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
import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PricingModel } from '@/features/pricing/types'

import { MAX_REFERENCE_BYTES, MAX_REFERENCE_IMAGES } from '../lib/options'

export function FieldLabel(props: { htmlFor?: string; children: string }) {
  return (
    <Label htmlFor={props.htmlFor} className='mb-1.5 text-[13px] font-medium'>
      {props.children}
    </Label>
  )
}

export function ModelSelect(props: {
  id: string
  models: PricingModel[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div>
      <FieldLabel htmlFor={props.id}>{t('Model')}</FieldLabel>
      <Select
        value={props.value}
        onValueChange={(value) => {
          if (value) props.onChange(String(value))
        }}
        disabled={props.disabled || props.models.length === 0}
      >
        <SelectTrigger id={props.id} className='h-10 w-full'>
          <SelectValue>
            {props.value || t('No models available')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {props.models.map((model) => (
              <SelectItem key={model.model_name} value={model.model_name}>
                {model.model_name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function ChipGroup<T extends string | number>(props: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div>
      <FieldLabel>{props.label}</FieldLabel>
      <div role='radiogroup' aria-label={props.label} className='flex flex-wrap gap-1.5'>
        {props.options.map((option) => {
          const active = option.value === props.value
          return (
            <button
              key={String(option.value)}
              type='button'
              role='radio'
              aria-checked={active}
              disabled={props.disabled}
              onClick={() => props.onChange(option.value)}
              className={cn(
                'focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-xs transition-colors outline-none focus-visible:ring-3 disabled:opacity-50',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type ReferenceImage = { id: string; file: File; url: string }

export function ReferencePicker(props: {
  label: string
  hint: string
  images: ReferenceImage[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const room = MAX_REFERENCE_IMAGES - props.images.length

  const accept = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    const oversized = images.filter((file) => file.size > MAX_REFERENCE_BYTES)
    if (oversized.length > 0) {
      toast.error(t('Each image must be 10 MB or smaller'))
    }
    const usable = images.filter((file) => file.size <= MAX_REFERENCE_BYTES)
    if (usable.length > room) {
      toast.error(
        t('At most {{count}} reference images', { count: MAX_REFERENCE_IMAGES })
      )
    }
    if (usable.length > 0) props.onAdd(usable.slice(0, Math.max(room, 0)))
  }

  return (
    <div>
      <FieldLabel>{props.label}</FieldLabel>
      <div
        className='grid grid-cols-4 gap-1.5 rounded-lg border border-dashed p-2'
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (!props.disabled) accept(Array.from(event.dataTransfer.files))
        }}
        onPaste={(event) => {
          if (!props.disabled) accept(Array.from(event.clipboardData.files))
        }}
      >
        {props.images.map((image) => (
          <div key={image.id} className='relative aspect-square'>
            <img
              src={image.url}
              alt=''
              className='size-full rounded-md object-cover'
            />
            <button
              type='button'
              aria-label={t('Remove image')}
              disabled={props.disabled}
              onClick={() => props.onRemove(image.id)}
              className='bg-background/80 absolute top-1 right-1 rounded-full p-0.5'
            >
              <X className='size-3' />
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type='button'
            aria-label={t('Add image')}
            disabled={props.disabled}
            onClick={() => input.current?.click()}
            className='text-muted-foreground hover:bg-muted flex aspect-square items-center justify-center rounded-md border border-dashed'
          >
            <ImagePlus className='size-5' />
          </button>
        )}
        <input
          ref={input}
          type='file'
          accept='image/*'
          multiple
          hidden
          onChange={(event) => {
            accept(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </div>
      <p className='text-muted-foreground mt-1.5 text-xs'>{props.hint}</p>
    </div>
  )
}

export function CostLine(props: { label: string; value?: string }) {
  if (!props.value) return null
  return (
    <div className='text-muted-foreground flex justify-between border-t pt-3 text-xs'>
      <span>{props.label}</span>
      <span className='text-foreground font-mono tabular-nums'>
        {props.value}
      </span>
    </div>
  )
}

const CUSTOM = 'custom'

/** Preset sizes plus a custom width × height. The value is "WxH" or "". */
export function SizePicker(props: {
  label: string
  presets: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState(
    () => !props.presets.some((preset) => preset.value === props.value)
  )
  const [width, height] = props.value.split('x')
  const update = (nextWidth: string, nextHeight: string) =>
    props.onChange(
      nextWidth && nextHeight ? `${nextWidth}x${nextHeight}` : ''
    )
  return (
    <div className='grid gap-2'>
      <ChipGroup
        label={props.label}
        options={[...props.presets, { value: CUSTOM, label: t('Custom') }]}
        value={custom ? CUSTOM : props.value}
        onChange={(value) => {
          if (value === CUSTOM) {
            setCustom(true)
            update(width || '1024', height || '1024')
            return
          }
          setCustom(false)
          props.onChange(value)
        }}
      />
      {custom && (
        <div className='flex items-center gap-2'>
          <Input
            type='number'
            min={64}
            max={4096}
            step={1}
            aria-label={t('Width')}
            placeholder={t('Width')}
            value={width ?? ''}
            onChange={(event) => update(event.target.value, height ?? '')}
          />
          <span className='text-muted-foreground text-xs'>×</span>
          <Input
            type='number'
            min={64}
            max={4096}
            step={1}
            aria-label={t('Height')}
            placeholder={t('Height')}
            value={height ?? ''}
            onChange={(event) => update(width ?? '', event.target.value)}
          />
        </div>
      )}
    </div>
  )
}

/** Preset numbers plus a custom value within [min, max]. */
export function NumberPicker(props: {
  label: string
  presets: number[]
  format: (value: number) => string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState(
    () => !props.presets.includes(props.value)
  )
  return (
    <div className='grid gap-2'>
      <ChipGroup<number | typeof CUSTOM>
        label={props.label}
        options={[
          ...props.presets.map((value) => ({
            value,
            label: props.format(value),
          })),
          { value: CUSTOM, label: t('Custom') },
        ]}
        value={custom ? CUSTOM : props.value}
        onChange={(value) => {
          if (value === CUSTOM) {
            setCustom(true)
            return
          }
          setCustom(false)
          props.onChange(value)
        }}
      />
      {custom && (
        <Input
          type='number'
          min={props.min}
          max={props.max}
          step={1}
          aria-label={props.label}
          className='max-w-32'
          value={props.value}
          onChange={(event) => {
            const next = Math.round(Number(event.target.value))
            if (Number.isFinite(next)) {
              props.onChange(Math.min(props.max, Math.max(props.min, next)))
            }
          }}
        />
      )}
      {custom && (
        <p className='text-muted-foreground -mt-1 text-xs'>
          {t('Between {{min}} and {{max}}', { min: props.min, max: props.max })}
        </p>
      )}
    </div>
  )
}

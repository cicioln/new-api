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
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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

export type ReferenceImage = { id: string; file: File; url: string }

export const MIN_SIDE = 64
export const MAX_SIDE = 4096

const pickClass =
  'bg-muted/50 hover:bg-muted data-[popup-open]:border-primary data-[popup-open]:text-primary inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0'

/** Compact model select for the composer toolbar. */
export function ModelPicker(props: {
  models: PricingModel[]
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={props.value}
      onValueChange={(value) => {
        if (value) props.onChange(String(value))
      }}
      disabled={props.models.length === 0}
    >
      <SelectTrigger
        aria-label={t('Model')}
        size='sm'
        className='bg-muted/50 h-8 max-w-[240px] min-w-0 flex-[0_1_240px] rounded-lg text-[13px]'
      >
        <SelectValue>
          <span className='truncate'>
            {props.value || t('No models available')}
          </span>
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
  )
}

/** Toolbar button that opens a settings panel above the composer. */
export function ToolbarPopover(props: {
  label: string
  icon: ReactNode
  summary: string
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={<button type='button' aria-label={props.label} className={pickClass} />}
      >
        {props.icon}
        <span className='font-mono tabular-nums'>{props.summary}</span>
        <ChevronDown className='text-muted-foreground' />
      </PopoverTrigger>
      <PopoverContent side='top' align='start' className='w-80 gap-3.5 p-3.5'>
        {props.children}
      </PopoverContent>
    </Popover>
  )
}

export function PanelSection(props: { title: string; children: ReactNode }) {
  return (
    <div className='grid gap-2'>
      <div className='text-muted-foreground text-xs font-medium'>{props.title}</div>
      {props.children}
    </div>
  )
}

const CUSTOM = 'custom'

export type SizePreset = {
  value: string
  label: string
  /** Shape drawn on the tile; 0 × 0 draws no shape. */
  w: number
  h: number
}

export function parseSize(value: string): [number, number] | null {
  const match = /^(\d+)x(\d+)$/.exec(value)
  return match ? [Number(match[1]), Number(match[2])] : null
}

export function isValidSize(value: string): boolean {
  if (value === '') return true
  const size = parseSize(value)
  return (
    size !== null &&
    size.every((side) => side >= MIN_SIDE && side <= MAX_SIDE)
  )
}

/** Ratio tiles plus a custom width × height. The value is "WxH" or "". */
export function SizeOptions(props: {
  presets: SizePreset[]
  value: string
  onChange: (value: string) => void
  /** Offer the custom width × height tile. Defaults to true. */
  allowCustom?: boolean
  /** Note shown under the tiles. */
  hint?: string
}) {
  const { t } = useTranslation()
  const allowCustom = props.allowCustom ?? true
  const [customState, setCustom] = useState(
    () => !props.presets.some((preset) => preset.value === props.value)
  )
  const custom = allowCustom && customState
  const tiles = allowCustom
    ? [...props.presets, { value: CUSTOM, label: t('Custom'), w: 0, h: 0 }]
    : props.presets
  const [width = '', height = ''] = props.value.split('x')
  const update = (nextWidth: string, nextHeight: string) =>
    props.onChange(`${nextWidth}x${nextHeight}`)

  return (
    <div className='grid gap-2'>
      <div role='radiogroup' className='grid grid-cols-4 gap-1.5'>
        {tiles.map(
          (preset) => {
            const active = custom
              ? preset.value === CUSTOM
              : preset.value === props.value
            return (
              <button
                key={preset.value || 'auto'}
                type='button'
                role='radio'
                aria-checked={active}
                onClick={() => {
                  if (preset.value === CUSTOM) {
                    setCustom(true)
                    const current = parseSize(props.value)
                    update(String(current?.[0] ?? 1024), String(current?.[1] ?? 1024))
                    return
                  }
                  setCustom(false)
                  props.onChange(preset.value)
                }}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'bg-muted/40 hover:bg-muted'
                )}
              >
                <span className='flex h-5 items-center'>
                  {preset.w > 0 ? (
                    <span
                      className='rounded-[2px] border-[1.5px] border-current'
                      style={{
                        width: Math.round((preset.w / Math.max(preset.w, preset.h)) * 18),
                        height: Math.round((preset.h / Math.max(preset.w, preset.h)) * 18),
                      }}
                    />
                  ) : (
                    <span className='text-[11px] leading-none'>
                      {preset.value === CUSTOM ? '…' : 'A'}
                    </span>
                  )}
                </span>
                {preset.label}
              </button>
            )
          }
        )}
      </div>
      {custom && (
        <>
          <div className='flex items-center gap-2 text-xs'>
            <Input
              type='number'
              min={MIN_SIDE}
              max={MAX_SIDE}
              step={1}
              aria-label={t('Width')}
              placeholder={t('Width')}
              className='h-8 font-mono'
              value={width}
              onChange={(event) => update(event.target.value, height)}
            />
            <span className='text-muted-foreground'>×</span>
            <Input
              type='number'
              min={MIN_SIDE}
              max={MAX_SIDE}
              step={1}
              aria-label={t('Height')}
              placeholder={t('Height')}
              className='h-8 font-mono'
              value={height}
              onChange={(event) => update(width, event.target.value)}
            />
            <span className='text-muted-foreground'>px</span>
          </div>
          <p
            className={cn(
              'text-xs',
              isValidSize(props.value) ? 'text-muted-foreground' : 'text-destructive'
            )}
          >
            {t('Between {{min}} and {{max}}', { min: MIN_SIDE, max: MAX_SIDE })}
          </p>
        </>
      )}
      {props.hint && <p className='text-muted-foreground text-xs'>{props.hint}</p>}
    </div>
  )
}

/** Preset numbers plus a custom value within [min, max]. */
export function NumberOptions(props: {
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
  const options: { value: number | typeof CUSTOM; label: string }[] = [
    ...props.presets.map((value) => ({ value, label: props.format(value) })),
    { value: CUSTOM, label: t('Custom') },
  ]
  return (
    <div className='grid gap-2'>
      <div role='radiogroup' className='grid grid-cols-4 gap-1.5'>
        {options.map((option) => {
          const active = custom
            ? option.value === CUSTOM
            : option.value === props.value
          return (
            <button
              key={String(option.value)}
              type='button'
              role='radio'
              aria-checked={active}
              onClick={() => {
                if (option.value === CUSTOM) {
                  setCustom(true)
                  return
                }
                setCustom(false)
                props.onChange(option.value)
              }}
              className={cn(
                'h-8 rounded-lg border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-muted/40 hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {custom && (
        <>
          <Input
            type='number'
            min={props.min}
            max={props.max}
            step={1}
            aria-label={t('Custom')}
            className='h-8 max-w-28 font-mono'
            value={props.value}
            onChange={(event) => {
              const next = Math.round(Number(event.target.value))
              if (Number.isFinite(next)) {
                props.onChange(Math.min(props.max, Math.max(props.min, next)))
              }
            }}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Between {{min}} and {{max}}', { min: props.min, max: props.max })}
          </p>
        </>
      )}
    </div>
  )
}

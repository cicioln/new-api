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
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import type { GroupOption, PlaygroundConfig } from '../../types'

type SliderKey = 'temperature' | 'top_p' | 'max_tokens'

const SLIDERS: {
  key: SliderKey
  labelKey: string
  translate: boolean
  min: number
  max: number
  step: number
  digits: number
}[] = [
  {
    key: 'temperature',
    labelKey: 'Temperature',
    translate: false,
    min: 0,
    max: 2,
    step: 0.1,
    digits: 1,
  },
  {
    key: 'top_p',
    labelKey: 'Top P',
    translate: false,
    min: 0,
    max: 1,
    step: 0.1,
    digits: 1,
  },
  {
    key: 'max_tokens',
    labelKey: 'Max output',
    translate: true,
    min: 256,
    max: 32768,
    step: 256,
    digits: 0,
  },
]

function getGroupLabel(group: GroupOption | undefined, fallback: string) {
  if (!group) return fallback
  return `${group.label} ×${Number(group.ratio).toFixed(1)}`
}

type SettingsPanelProps = {
  config: PlaygroundConfig
  groups: GroupOption[]
  disabled?: boolean
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { t } = useTranslation()
  const selectedGroup = props.groups.find(
    (group) => group.value === props.config.group
  )

  return (
    <section className='bg-card rounded-[10px] border p-[18px]'>
      <div className='mb-3.5'>
        <Label
          htmlFor='playground-group'
          className='mb-1.5 text-[13px] font-medium'
        >
          {t('Group')}
        </Label>
        <Select
          value={props.config.group}
          onValueChange={(value) => {
            if (value) props.onConfigChange('group', value)
          }}
          disabled={props.disabled || props.groups.length === 0}
        >
          <SelectTrigger id='playground-group' className='h-10 w-full'>
            <SelectValue>
              {getGroupLabel(selectedGroup, props.config.group)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {props.groups.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {getGroupLabel(group, group.value)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='mb-3.5'>
        <Label
          htmlFor='playground-system-prompt'
          className='mb-1.5 text-[13px] font-medium'
        >
          {t('System prompt')}
        </Label>
        <Textarea
          id='playground-system-prompt'
          className='min-h-20'
          disabled={props.disabled}
          value={props.config.system_prompt}
          onChange={(event) =>
            props.onConfigChange('system_prompt', event.target.value)
          }
        />
      </div>

      {SLIDERS.map((slider) => {
        const value = props.config[slider.key]
        return (
          <div className='mb-3.5' key={slider.key}>
            <div className='mb-1.5 flex justify-between text-[13px] font-medium'>
              <span id={`playground-${slider.key}`}>
                {slider.translate ? t(slider.labelKey) : slider.labelKey}
              </span>
              <span className='text-muted-foreground font-mono font-normal'>
                {value.toFixed(slider.digits)}
              </span>
            </div>
            <Slider
              aria-labelledby={`playground-${slider.key}`}
              className='py-1.5'
              disabled={props.disabled}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={[value]}
              onValueChange={(next) => {
                const first = Array.isArray(next) ? next[0] : next
                props.onConfigChange(slider.key, first)
              }}
            />
          </div>
        )
      })}

      <div className='flex items-center justify-between gap-4 border-t pt-[13px]'>
        <Label
          htmlFor='playground-stream'
          className='text-[13.5px] font-medium'
        >
          {t('Streaming')}
        </Label>
        <Switch
          id='playground-stream'
          checked={props.config.stream}
          disabled={props.disabled}
          onCheckedChange={(checked) => props.onConfigChange('stream', checked)}
          className='data-checked:bg-success data-unchecked:bg-border px-px data-[size=default]:h-5 data-[size=default]:w-[34px]'
        />
      </div>
    </section>
  )
}

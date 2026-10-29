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
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import dayjs from '@/lib/dayjs'

import { handleSetChannelMaintenance } from '../../lib'

const MAX_NOTE_LENGTH = 200

type RecoveryPreset = 'none' | 'hour' | 'evening' | 'custom'

const RECOVERY_PRESETS: { value: RecoveryPreset; label: string }[] = [
  { value: 'none', label: 'Not set' },
  { value: 'hour', label: 'In 1 hour' },
  { value: 'evening', label: 'Today 18:00' },
  { value: 'custom', label: 'Custom' },
]

/** Recovery time in Unix seconds for a preset; 0 when not set or invalid. */
function resolveRecoveryTime(preset: RecoveryPreset, custom: string): number {
  if (preset === 'hour') return dayjs().add(1, 'hour').unix()
  if (preset === 'evening') {
    return dayjs().hour(18).minute(0).second(0).millisecond(0).unix()
  }
  if (preset === 'custom' && custom) {
    const time = dayjs(custom)
    return time.isValid() ? time.unix() : 0
  }
  return 0
}

type MaintenanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelIds: number[]
  /** Shown in the description for a single channel. */
  channelName?: string
  onSuccess?: () => void
}

export function MaintenanceDialog(props: MaintenanceDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [preset, setPreset] = useState<RecoveryPreset>('none')
  const [custom, setCustom] = useState('')
  const [autoRestore, setAutoRestore] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Past 18:00 the "today" preset would already be over.
  const eveningPassed = dayjs().hour() >= 18
  const until = resolveRecoveryTime(preset, custom)
  const customInvalid =
    preset === 'custom' && (!until || until <= dayjs().unix())

  const handleSubmit = async () => {
    setSubmitting(true)
    await handleSetChannelMaintenance(
      props.channelIds,
      {
        maintenance_note: note.trim(),
        maintenance_until: until,
        maintenance_auto_restore: until > 0 && autoRestore,
      },
      queryClient,
      () => {
        props.onOpenChange(false)
        props.onSuccess?.()
      }
    )
    setSubmitting(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Set maintenance')}
      description={
        props.channelName
          ? t(
              'Channel {{name}} stops serving requests; its models show as under maintenance in the model square.',
              { name: props.channelName }
            )
          : t(
              '{{count}} channel(s) stop serving requests; their models show as under maintenance in the model square.',
              { count: props.channelIds.length }
            )
      }
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting || customInvalid}
          >
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Confirm maintenance')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-2'>
        <div className='space-y-2'>
          <Label htmlFor='maintenance-note'>
            {t('Maintenance note (shown to users, optional)')}
          </Label>
          <Textarea
            id='maintenance-note'
            rows={2}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={t('e.g. Upstream upgrade, service paused')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
          />
          <p className='text-muted-foreground text-right text-xs tabular-nums'>
            {note.length}/{MAX_NOTE_LENGTH}
          </p>
        </div>

        <div className='space-y-2'>
          <Label>{t('Expected recovery')}</Label>
          <ToggleGroup
            value={[preset]}
            onValueChange={(values: unknown[]) => {
              const next = values[0]
              if (typeof next === 'string') setPreset(next as RecoveryPreset)
            }}
            spacing={0.5}
            aria-label={t('Expected recovery')}
            className='bg-card gap-0 rounded-lg border p-[3px]'
          >
            {RECOVERY_PRESETS.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                disabled={item.value === 'evening' && eveningPassed}
                className='text-subtle-foreground hover:text-foreground aria-pressed:text-foreground h-[26px] min-w-0 rounded-md px-2.5 text-[12.5px] font-normal hover:bg-transparent aria-pressed:font-medium'
              >
                {t(item.label)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {preset === 'custom' && (
            <Input
              type='datetime-local'
              value={custom}
              aria-label={t('Expected recovery')}
              onChange={(e) => setCustom(e.target.value)}
              className='h-8 text-sm tabular-nums'
              disabled={submitting}
            />
          )}
          {until > 0 && !customInvalid && (
            <p className='text-muted-foreground text-xs'>
              {t('Expected recovery {{time}}', {
                time: dayjs.unix(until).format('YYYY-MM-DD HH:mm'),
              })}
            </p>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          <Checkbox
            id='maintenance-auto-restore'
            checked={until > 0 && autoRestore}
            onCheckedChange={(checked) => setAutoRestore(!!checked)}
            disabled={submitting || until <= 0}
          />
          <Label
            htmlFor='maintenance-auto-restore'
            className='text-sm font-normal'
          >
            {t('Auto restore to enabled at that time')}
          </Label>
        </div>
      </div>
    </Dialog>
  )
}

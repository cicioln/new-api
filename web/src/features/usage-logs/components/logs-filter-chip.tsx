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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

interface LogsFilterChipProps {
  title: string
  value?: string
  inputClassName?: string
  onApply: (value: string) => void
}

/**
 * Dashed "+ Title" toolbar chip for a free-text log filter. It matches the
 * faceted filter trigger, which only supports a fixed option list.
 */
export function LogsFilterChip(props: LogsFilterChipProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(props.value ?? '')

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(props.value ?? '')
    setOpen(nextOpen)
  }

  const apply = (value: string) => {
    props.onApply(value.trim())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='text-muted-foreground h-8 rounded-lg border-dashed bg-transparent px-3 text-[13px] font-normal shadow-none'
          />
        }
      >
        <span aria-hidden='true'>+</span>
        {props.title}
        {props.value && (
          <>
            <Separator orientation='vertical' className='mx-2 h-4' />
            <Badge
              variant='secondary'
              className={`max-w-32 truncate rounded-sm px-1 font-normal ${props.inputClassName ?? ''}`}
            >
              {props.value}
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-64 space-y-2 p-2'>
        <Input
          autoFocus
          autoComplete='off'
          aria-label={props.title}
          placeholder={props.title}
          className={`h-8 text-[13px] ${props.inputClassName ?? ''}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') apply(draft)
          }}
        />
        <div className='flex justify-end gap-1.5'>
          {props.value && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => apply('')}
            >
              {t('Clear filters')}
            </Button>
          )}
          <Button type='button' size='sm' onClick={() => apply(draft)}>
            {t('Apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

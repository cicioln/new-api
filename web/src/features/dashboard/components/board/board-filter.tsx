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

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  EMPTY_BOARD_FILTERS,
  type BoardFilters,
} from '@/features/dashboard/hooks/use-board-data'

/** Narrows the board to a model name and, for administrators, a user. */
export function BoardFilter(props: {
  value: BoardFilters
  onChange: (filters: BoardFilters) => void
  isAdmin: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<BoardFilters>(props.value)
  const active = Boolean(props.value.modelName || props.value.username)

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(props.value)
    setOpen(next)
  }

  const apply = (filters: BoardFilters) => {
    props.onChange(filters)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant={active ? 'secondary' : 'outline'}
            size='sm'
          />
        }
      >
        {t('Filter')}
      </PopoverTrigger>
      <PopoverContent align='end' className='w-72 gap-3 p-3.5'>
        <form
          className='flex flex-col gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            apply({
              modelName: draft.modelName.trim(),
              username: draft.username.trim(),
            })
          }}
        >
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='board-filter-model'>{t('Model name')}</Label>
            <Input
              id='board-filter-model'
              value={draft.modelName}
              placeholder={t('Filter by model name')}
              onChange={(event) =>
                setDraft({ ...draft, modelName: event.target.value })
              }
            />
          </div>
          {props.isAdmin && (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='board-filter-user'>{t('Username')}</Label>
              <Input
                id='board-filter-user'
                value={draft.username}
                placeholder={t('Filter by username')}
                onChange={(event) =>
                  setDraft({ ...draft, username: event.target.value })
                }
              />
            </div>
          )}
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => apply(EMPTY_BOARD_FILTERS)}
            >
              {t('Reset')}
            </Button>
            <Button type='submit' size='sm'>
              {t('Apply')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

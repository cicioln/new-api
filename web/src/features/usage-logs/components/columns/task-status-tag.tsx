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

import { cn } from '@/lib/utils'

import { RUNNING_TASK_STATUSES, TASK_STATUS } from '../../constants'
import type { TaskLog } from '../../types'

const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs! font-medium! whitespace-nowrap'

export function TaskStatusTag(props: { log: TaskLog }) {
  const { t } = useTranslation()
  const status = props.log.status
  let toneClass = 'bg-muted text-muted-foreground'
  let label = t('Unknown')
  if (status === TASK_STATUS.SUCCESS) {
    toneClass = 'bg-success/12 text-success'
    label = t('Success')
  } else if (status === TASK_STATUS.FAILURE) {
    toneClass = 'bg-destructive/10 text-destructive'
    // A refunded failure has its pre-consumed quota cleared back to zero.
    label = props.log.quota === 0 ? t('Failed · Refunded') : t('Failed')
  } else if (RUNNING_TASK_STATUSES.has(status)) {
    toneClass = 'bg-primary/12 text-primary'
    label = t('In Progress')
  }
  return (
    <span className={cn(tagClass, toneClass)}>
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {label}
    </span>
  )
}

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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import { CHANNEL_TYPES } from '@/features/channels/constants'
import dayjs from '@/lib/dayjs'
import { formatTimestampToDate } from '@/lib/format'

import { RUNNING_TASK_STATUSES, TASK_STATUS } from '../../constants'
import { taskActionMapper } from '../../lib/mappers'
import type { TaskLog } from '../../types'
import { LogCostDisplay } from '../log-cost-display'
import { TaskStatusTag } from './task-status-tag'

const numericCellClass = 'font-mono! text-[12.5px]! tabular-nums'

export function useTaskLogsColumns(): ColumnDef<TaskLog>[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        accessorKey: 'submit_time',
        header: t('Submit Time'),
        cell: ({ row }) => (
          <span
            className='text-muted-foreground font-mono! text-xs!'
            title={formatTimestampToDate(row.original.submit_time, 'seconds')}
          >
            {dayjs.unix(row.original.submit_time).format('MM-DD HH:mm')}
          </span>
        ),
      },
      {
        accessorKey: 'task_id',
        header: t('Task ID'),
        cell: ({ row }) => {
          const taskId = row.original.task_id
          const shortId =
            taskId.length > 14
              ? `${taskId.slice(0, 9)}…${taskId.slice(-2)}`
              : taskId
          return (
            <span className='font-mono! text-xs!' title={taskId}>
              {shortId || '—'}
            </span>
          )
        },
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'platform',
        header: t('Platform'),
        cell: ({ row }) => {
          const platform = row.original.platform
          // Channel-backed tasks store the channel type number as platform.
          const channelType =
            CHANNEL_TYPES[Number(platform) as keyof typeof CHANNEL_TYPES]
          return <span>{channelType ?? platform}</span>
        },
      },
      {
        accessorKey: 'action',
        header: t('Type'),
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {t(
              taskActionMapper.getLabel(
                row.original.action,
                row.original.action
              )
            )}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => <TaskStatusTag log={row.original} />,
      },
      {
        accessorKey: 'progress',
        header: t('Progress'),
        cell: ({ row }) => {
          const value = Math.min(
            100,
            Math.max(0, Number.parseFloat(row.original.progress ?? '') || 0)
          )
          return (
            <div className='flex min-w-[120px] items-center gap-2'>
              <Progress
                value={value}
                aria-label={t('Progress')}
                className='flex-1 gap-0'
              />
              <span className='text-muted-foreground font-mono! text-[11.5px]!'>
                {value}%
              </span>
            </div>
          )
        },
      },
      {
        id: 'duration',
        header: t('Duration'),
        cell: ({ row }) => {
          const log = row.original
          // Running tasks show the time elapsed so far.
          const end = RUNNING_TASK_STATUSES.has(log.status)
            ? dayjs().unix()
            : log.finish_time
          const seconds = end ? end - log.submit_time : 0
          // Failed tasks without a recorded run time show no duration.
          const failedInstantly =
            log.status === TASK_STATUS.FAILURE && seconds <= 0
          if (!log.submit_time || !end || failedInstantly) {
            return <span className={numericCellClass}>—</span>
          }
          const elapsed = Math.max(0, seconds)
          const minutes = Math.floor(elapsed / 60)
          const label =
            minutes > 0
              ? `${minutes}m ${String(elapsed % 60).padStart(2, '0')}s`
              : `${elapsed}s`
          return <span className={numericCellClass}>{label}</span>
        },
      },
      {
        accessorKey: 'quota',
        header: t('Cost'),
        cell: ({ row }) => (
          <LogCostDisplay plain quota={row.original.quota} other={null} />
        ),
      },
    ],
    [t]
  )
}

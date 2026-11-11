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
import { Link } from '@tanstack/react-router'
import { History } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllLogs, getAllTaskLogs } from '@/features/usage-logs/api'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import type { TaskLog } from '@/features/usage-logs/types'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

const RECENT_LIMIT = 20

type LogFilter = 'all' | 'error'

const TASK_STATUS_VARIANT: Record<string, StatusVariant> = {
  SUCCESS: 'success',
  FAILURE: 'danger',
  IN_PROGRESS: 'info',
  QUEUED: 'warning',
  SUBMITTED: 'warning',
  NOT_START: 'neutral',
}

export function UserLogsPanel(props: { username: string }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<LogFilter>('all')
  const logs = useQuery({
    queryKey: ['user-detail-logs', props.username, filter],
    queryFn: async () => {
      const response = requireServerSuccess(
        await getAllLogs({
          username: props.username,
          page_size: RECENT_LIMIT,
          type: filter === 'error' ? LOG_TYPE_ENUM.ERROR : undefined,
        })
      )
      return (response.data?.items ?? []) as UsageLog[]
    },
  })

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex gap-1'>
          {(['all', 'error'] as const).map((value) => (
            <Button
              key={value}
              size='sm'
              variant={filter === value ? 'secondary' : 'ghost'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? t('All') : t('Errors')}
            </Button>
          ))}
        </div>
        <Button
          size='sm'
          variant='outline'
          render={
            <Link
              to='/usage-logs/$section'
              params={{ section: 'common' }}
              search={{ username: props.username }}
            />
          }
        >
          {t('Open in usage logs')}
        </Button>
      </div>
      {logs.isLoading && <Skeleton className='h-40 w-full' />}
      {logs.data && logs.data.length === 0 && (
        <EmptyState
          icon={History}
          title={t('No recent requests')}
          className='min-h-[180px]'
        />
      )}
      {logs.data && logs.data.length > 0 && (
        <div className='overflow-x-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Time')}</TableHead>
                <TableHead>{t('Model')}</TableHead>
                <TableHead>{t('Token')}</TableHead>
                <TableHead>{t('Result')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.data.map((log) => {
                const isError = log.type === LOG_TYPE_ENUM.ERROR
                return (
                  <TableRow key={`${log.id}-${log.created_at}`}>
                    <TableCell className='font-mono text-xs whitespace-nowrap tabular-nums'>
                      {formatTimestampToDate(log.created_at)}
                    </TableCell>
                    <TableCell className='text-xs whitespace-nowrap'>
                      {log.model_name || '-'}
                    </TableCell>
                    <TableCell className='text-xs whitespace-nowrap'>
                      {log.token_name || '-'}
                    </TableCell>
                    <TableCell className='min-w-[180px] text-xs'>
                      {isError ? (
                        <span className='text-destructive break-words'>
                          {log.content}
                        </span>
                      ) : (
                        <span className='font-mono tabular-nums'>
                          {formatQuota(log.quota)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function UserTasksPanel(props: { userId: number }) {
  const { t } = useTranslation()
  const tasks = useQuery({
    queryKey: ['user-detail-tasks', props.userId],
    queryFn: async () => {
      const response = requireServerSuccess(
        await getAllTaskLogs({ user_id: props.userId, page_size: RECENT_LIMIT })
      )
      return (response.data?.items ?? []) as TaskLog[]
    },
  })

  if (tasks.isLoading) return <Skeleton className='h-40 w-full' />
  if (!tasks.data || tasks.data.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={t('No tasks')}
        description={t(
          'Rejected submissions never create a task. Check the requests tab for them.'
        )}
        className='min-h-[180px]'
      />
    )
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Submitted')}</TableHead>
            <TableHead>{t('Model')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead>{t('Reason')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.data.map((task) => (
            <TableRow key={task.id}>
              <TableCell className='font-mono text-xs whitespace-nowrap tabular-nums'>
                {formatTimestampToDate(task.submit_time)}
                <div className='text-muted-foreground'>{task.task_id}</div>
              </TableCell>
              <TableCell className='text-xs whitespace-nowrap'>
                {task.properties?.origin_model_name || task.action}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={task.status}
                  variant={TASK_STATUS_VARIANT[task.status] ?? 'neutral'}
                  copyable={false}
                />
              </TableCell>
              <TableCell className='text-destructive min-w-[160px] text-xs break-words'>
                {task.fail_reason || ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

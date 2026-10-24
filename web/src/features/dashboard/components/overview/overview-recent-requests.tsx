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
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { getUserLogs } from '@/features/usage-logs/api'
import { LOG_TYPE_ENUM } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import { toIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'
import { formatLogQuota, formatNumber, formatUseTime } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const RECENT_REQUEST_LIMIT = 6
const SKELETON_ROWS = ['a', 'b', 'c', 'd']

function RequestStatus(props: { log: UsageLog }) {
  const { t } = useTranslation()
  const failed = props.log.type === LOG_TYPE_ENUM.ERROR
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-medium',
        failed
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-success'
      )}
    >
      <span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
      {failed ? t('Failed') : t('Success')}
    </span>
  )
}

export function OverviewRecentRequests() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const logsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'recent-requests'],
    queryFn: async () => {
      const result = requireServerSuccess(
        await getUserLogs({ p: 1, page_size: RECENT_REQUEST_LIMIT })
      )
      return (result.data?.items ?? []) as UsageLog[]
    },
    staleTime: 30 * 1000,
  })
  // Usage logs also hold top-ups and admin actions; only API calls belong here.
  const logs = (logsQuery.data ?? []).filter(
    (log) =>
      log.type === LOG_TYPE_ENUM.CONSUME || log.type === LOG_TYPE_ENUM.ERROR
  )

  return (
    <section className='bg-card min-w-0 overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between px-[18px] pt-4 pb-3'>
        <h3 className='text-sm font-semibold'>{t('Recent requests')}</h3>
        <Link
          to='/usage-logs/$section'
          params={{ section: 'common' }}
          className='text-muted-foreground hover:text-foreground text-xs'
        >
          {t('View all logs')} →
        </Link>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full border-collapse text-[13px]'>
          <thead>
            <tr className='bg-background text-muted-foreground border-y text-left text-xs [&>th]:px-[18px] [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap'>
              <th>{t('Time')}</th>
              <th>{t('Model')}</th>
              <th>{t('API Key')}</th>
              <th>{t('Status')}</th>
              <th className='text-right'>{t('Tokens')}</th>
              <th className='text-right'>{t('Latency')}</th>
              <th className='text-right'>{t('Cost')}</th>
            </tr>
          </thead>
          <tbody className='[&_td]:px-[18px] [&_td]:py-[11px] [&_td]:whitespace-nowrap [&>tr]:border-b [&>tr:last-child]:border-0'>
            {logsQuery.isLoading &&
              SKELETON_ROWS.map((key) => (
                <tr key={key}>
                  <td colSpan={7}>
                    <Skeleton className='h-4 w-full' />
                  </td>
                </tr>
              ))}
            {!logsQuery.isLoading && logs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className='text-muted-foreground py-10 text-center text-sm'
                >
                  {t('No requests yet')}
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className='hover:bg-muted/50 transition-colors'>
                <td className='text-muted-foreground font-mono text-xs'>
                  {dayjs(log.created_at * 1000).format('HH:mm:ss')}
                </td>
                <td className='font-mono text-[12.5px]'>
                  {log.model_name || '-'}
                </td>
                <td>{log.token_name || '-'}</td>
                <td>
                  <RequestStatus log={log} />
                </td>
                <td className='text-right font-mono text-[12.5px] tabular-nums'>
                  {formatNumber(
                    log.prompt_tokens + log.completion_tokens,
                    locale
                  )}
                </td>
                <td className='text-right font-mono text-[12.5px] tabular-nums'>
                  {formatUseTime(log.use_time)}
                </td>
                <td className='text-right font-mono text-[12.5px] tabular-nums'>
                  {formatLogQuota(log.quota)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

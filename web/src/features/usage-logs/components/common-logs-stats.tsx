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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import {
  formatCompactNumber,
  formatLogQuota,
  formatNumber,
  formatUseTime,
} from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getLogStats, getUserLogStats } from '../api'
import { DEFAULT_LOG_STATS } from '../constants'
import { buildApiParams } from '../lib/utils'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

function StatBadge(props: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <span className='border-border/60 bg-muted/25 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs shadow-xs'>
      <span className={cn('h-3.5 w-0.5 rounded-full', props.accent)} />
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-foreground/85 font-mono font-semibold tabular-nums'>
        {props.value}
      </span>
    </span>
  )
}

function StatCard(props: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  valueClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div className='bg-card flex min-w-0 flex-col gap-1.5 rounded-lg border px-4 py-3.5'>
      <div className='text-muted-foreground text-[12.5px]'>{props.label}</div>
      <div
        className={cn(
          'truncate font-mono text-[22px] leading-tight font-semibold tracking-tight tabular-nums',
          props.valueClassName
        )}
      >
        {props.value}
      </div>
      {props.children}
      {props.hint && (
        <div className='text-subtle-foreground truncate text-[11.5px]'>
          {props.hint}
        </div>
      )}
    </div>
  )
}

const TOKEN_MIX = [
  { key: 'input', label: 'Input', bar: 'bg-sky-500' },
  { key: 'cacheRead', label: 'Cache read', bar: 'bg-emerald-500' },
  { key: 'cacheWrite', label: 'Cache write', bar: 'bg-amber-500' },
  { key: 'output', label: 'Output', bar: 'bg-violet-500' },
] as const

/** Badges sit inside the toolbar on mobile; desktop shows design KPI cards above the table. */
export function CommonLogsStats(props: { variant?: 'badges' | 'cards' }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { isAdminView: isAdmin } = useLogsViewScope()
  const searchParams = route.useSearch()
  const { sensitiveVisible } = useUsageLogsContext()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['usage-logs-stats', isAdmin, searchParams],
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin,
      })

      const result = isAdmin
        ? requireServerSuccess(await getLogStats(params))
        : requireServerSuccess(await getUserLogStats(params))

      return result.success
        ? result.data || DEFAULT_LOG_STATS
        : DEFAULT_LOG_STATS
    },
    placeholderData: (previousData) => previousData,
  })

  const quotaDisplay = sensitiveVisible
    ? formatLogQuota(stats?.quota || 0)
    : '••••'

  if (props.variant === 'cards') {
    const gridClass =
      'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'
    if (isLoading) {
      return (
        <div className={gridClass}>
          {['quota', 'tokens', 'cache', 'timing', 'rate', 'success'].map(
            (key) => (
              <Skeleton key={key} className='h-[94px] rounded-lg' />
            )
          )}
        </div>
      )
    }
    const requests = stats?.request_count ?? 0
    const errors = stats?.error_count ?? 0
    const attempts = requests + errors
    const output = stats?.completion_tokens ?? 0
    const hasCacheStats = stats?.input_tokens_total != null
    const cacheRead = stats?.cache_read_tokens ?? 0
    const cacheWrite = stats?.cache_write_tokens ?? 0
    const inputTotal = stats?.input_tokens_total ?? stats?.prompt_tokens ?? 0
    const mix = {
      input: Math.max(inputTotal - cacheRead - cacheWrite, 0),
      cacheRead,
      cacheWrite,
      output,
    }
    const tokenTotal = inputTotal + output
    const hitRate =
      hasCacheStats && inputTotal > 0 ? (cacheRead / inputTotal) * 100 : null
    const compact = (value: number) => formatCompactNumber(value, locale)

    return (
      <div className={gridClass}>
        <StatCard
          label={t('Spend in range')}
          value={quotaDisplay}
          hint={t('{{count}} requests', { count: requests })}
        />
        <StatCard
          label={t('Total tokens')}
          value={compact(tokenTotal)}
          hint={
            hasCacheStats
              ? TOKEN_MIX.map(
                  (item) => `${t(item.label)} ${compact(mix[item.key])}`
                ).join(' · ')
              : `${t('Input')} ${compact(inputTotal)} · ${t('Output')} ${compact(output)}`
          }
        >
          {hasCacheStats && tokenTotal > 0 && (
            <div className='bg-muted flex h-1 overflow-hidden rounded-full'>
              {TOKEN_MIX.map((item) =>
                mix[item.key] > 0 ? (
                  <span
                    key={item.key}
                    className={item.bar}
                    style={{ width: `${(mix[item.key] / tokenTotal) * 100}%` }}
                  />
                ) : null
              )}
            </div>
          )}
        </StatCard>
        <StatCard
          label={t('Cache hit rate')}
          value={hitRate != null ? `${hitRate.toFixed(1)}%` : '—'}
          valueClassName={
            hitRate != null ? 'text-emerald-600 dark:text-emerald-400' : undefined
          }
          hint={t('Cache read / all input')}
        />
        <StatCard
          label={t('Average first token')}
          value={
            stats?.avg_frt_ms != null
              ? formatUseTime(stats.avg_frt_ms / 1000)
              : '—'
          }
          hint={t('Average total {{time}}', {
            time: formatUseTime(stats?.avg_use_time ?? 0),
          })}
        />
        <StatCard
          label={`${t('RPM')} / ${t('TPM')}`}
          value={
            <>
              {formatNumber(stats?.rpm || 0, locale)}
              <span className='text-muted-foreground text-sm font-medium'>
                {' / '}
                {compact(stats?.tpm || 0)}
              </span>
            </>
          }
          hint={t('Last minute')}
        />
        <StatCard
          label={t('Success rate')}
          value={
            attempts > 0 ? `${((requests / attempts) * 100).toFixed(1)}%` : '—'
          }
          valueClassName={
            errors > 0 && attempts > 0 && requests / attempts < 0.95
              ? 'text-amber-600 dark:text-amber-400'
              : undefined
          }
          hint={t('{{count}} failed', { count: errors })}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-7 w-[150px] rounded-md' />
        <Skeleton className='h-7 w-[100px] rounded-md' />
        <Skeleton className='h-7 w-[120px] rounded-md' />
      </div>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <StatBadge
        label={t('Usage')}
        value={quotaDisplay}
        accent='bg-sky-500/70'
      />
      <StatBadge
        label={t('RPM')}
        value={formatNumber(stats?.rpm || 0, locale)}
        accent='bg-rose-500/65'
      />
      <StatBadge
        label={t('TPM')}
        value={formatNumber(stats?.tpm || 0, locale)}
        accent='bg-slate-400/70'
      />
    </div>
  )
}

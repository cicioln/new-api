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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getCacheStats } from '@/features/system-settings/general/channel-affinity/api'
import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { useSystemInstances } from '../hooks/use-system-instances'
import {
  formatBytePair,
  formatBytes,
  getDatabaseLabel,
  getPrimaryInstance,
  getUptimeParts,
} from '../lib/format'

type PerformanceStats = {
  cache_stats?: {
    active_disk_files?: number
    current_disk_usage_bytes?: number
    active_memory_buffers?: number
    current_memory_usage_bytes?: number
  }
  memory_stats?: { num_goroutine?: number }
}

type LogFilesInfo = {
  enabled: boolean
  file_count?: number
  total_size?: number
}

function StatCard(props: {
  label: string
  value: string
  unit?: string
  percent?: number
  loading?: boolean
}) {
  return (
    <div className='bg-card min-w-0 rounded-lg border p-[18px]'>
      <small className='text-muted-foreground text-[12.5px]'>
        {props.label}
      </small>
      {props.loading ? (
        <Skeleton className='mt-1 h-9 w-28' />
      ) : (
        <div className='truncate text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums'>
          {props.value}
          {props.unit && (
            <small className='text-muted-foreground text-[15px] font-medium'>
              {props.unit}
            </small>
          )}
        </div>
      )}
      <Progress
        value={props.percent ?? 0}
        aria-label={props.label}
        className='mt-2.5 [&_[data-slot=progress-track]]:h-1.5'
      />
    </div>
  )
}

function FactsCard(props: {
  title: string
  facts: Array<[string, ReactNode]>
  loading?: boolean
}) {
  return (
    <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
      <h2 className='text-sm font-semibold'>{props.title}</h2>
      <dl className='mt-3.5 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]'>
        {props.facts.map(([label, value]) => (
          <div key={label} className='contents'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='truncate font-mono text-[12.5px]'>
              {props.loading ? <Skeleton className='h-4 w-32' /> : value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SystemOverview() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const instancesQuery = useSystemInstances()
  const performanceQuery = useQuery({
    queryKey: ['system-info', 'performance'],
    queryFn: async () => {
      const res = await api.get('/api/performance/stats')
      requireServerSuccess(res.data)
      return res.data.data as PerformanceStats
    },
    retry: false,
  })
  const logFilesQuery = useQuery({
    queryKey: ['system-info', 'log-files'],
    queryFn: async () => {
      const res = await api.get('/api/performance/logs')
      requireServerSuccess(res.data)
      return res.data.data as LogFilesInfo
    },
    retry: false,
  })
  const affinityQuery = useQuery({
    queryKey: ['system-info', 'channel-affinity'],
    queryFn: async () => {
      const res = await getCacheStats()
      requireServerSuccess(res)
      return res.data ?? null
    },
    retry: false,
  })

  const instances = instancesQuery.data ?? []
  const primary = getPrimaryInstance(instances)
  const runtime = primary?.info?.runtime
  const resources = primary?.info?.resources
  const loadingInstances = instancesQuery.isLoading

  const cpuPercent = resources?.cpu?.usage_percent
  const memory = resources?.memory
  const storage = resources?.storage

  let memoryValue = '-'
  let memoryUnit: string | undefined
  if (memory?.total_bytes) {
    const pair = formatBytePair(
      memory.used_bytes ?? 0,
      memory.total_bytes,
      locale
    )
    memoryValue = pair.used
    memoryUnit = ` / ${pair.total}`
  } else if (typeof memory?.usage_percent === 'number') {
    memoryValue = formatNumber(Math.round(memory.usage_percent), locale)
    memoryUnit = '%'
  }

  let storageValue = '-'
  let storageUnit: string | undefined
  if (storage?.total_bytes) {
    const pair = formatBytePair(
      storage.used_bytes ?? 0,
      storage.total_bytes,
      locale
    )
    storageValue = pair.used
    storageUnit = ` / ${pair.total}`
  }

  const goRuntime = [
    runtime?.go_version,
    [runtime?.goos, runtime?.goarch].filter(Boolean).join('/'),
  ]
    .filter(Boolean)
    .join(' ')

  let redisValue = '-'
  if (runtime && typeof runtime.redis_enabled === 'boolean') {
    redisValue = runtime.redis_enabled ? t('Connected') : t('Not enabled')
  }

  const uptime = getUptimeParts(
    runtime?.started_at ?? primary?.started_at,
    Date.now()
  )
  const uptimeValue = uptime
    ? t('{{days}}d {{hours}}h {{minutes}}m', uptime)
    : '-'

  const workerCount = instances.filter(
    (instance) => instance !== primary && instance.status === 'online'
  ).length
  let nodesValue = '-'
  if (primary) {
    nodesValue = `${primary.info?.role?.is_master ? 'master' : 'worker'} · ${t(
      '{{count}} other nodes',
      { count: workerCount }
    )}`
  }

  const cacheStats = performanceQuery.data?.cache_stats
  const affinity = affinityQuery.data
  let affinityValue = '-'
  if (affinity) {
    affinityValue = affinity.enabled
      ? t('{{count}} of {{capacity}} entries', {
          count: affinity.total,
          capacity: formatNumber(affinity.cache_capacity, locale),
        })
      : t('Not enabled')
  }

  const logFiles = logFilesQuery.data
  let logFilesValue = '-'
  if (logFiles) {
    logFilesValue = logFiles.enabled
      ? `${t('{{count}} files', { count: logFiles.file_count ?? 0 })} · ${formatBytes(logFiles.total_size ?? 0, locale)}`
      : t('Not enabled')
  }

  const goroutines = performanceQuery.data?.memory_stats?.num_goroutine

  return (
    <div className='space-y-3.5'>
      <div className='grid grid-cols-1 gap-3.5 md:grid-cols-3'>
        <StatCard
          label={t('CPU')}
          value={
            typeof cpuPercent === 'number'
              ? formatNumber(Math.round(cpuPercent), locale)
              : '-'
          }
          unit={typeof cpuPercent === 'number' ? '%' : undefined}
          percent={cpuPercent}
          loading={loadingInstances}
        />
        <StatCard
          label={t('Memory')}
          value={memoryValue}
          unit={memoryUnit}
          percent={memory?.usage_percent}
          loading={loadingInstances}
        />
        <StatCard
          label={t('Disk')}
          value={storageValue}
          unit={storageUnit}
          percent={storage?.used_percent}
          loading={loadingInstances}
        />
      </div>
      <div className='grid grid-cols-1 gap-3.5 md:grid-cols-2'>
        <FactsCard
          title={t('Runtime environment')}
          loading={loadingInstances}
          facts={[
            [t('Version'), runtime?.version || '-'],
            ['Go', goRuntime || '-'],
            [t('Database'), getDatabaseLabel(runtime?.database)],
            ['Redis', redisValue],
            [t('Uptime'), uptimeValue],
            [t('Nodes'), nodesValue],
          ]}
        />
        <FactsCard
          title={t('Cache and queues')}
          loading={
            performanceQuery.isLoading ||
            logFilesQuery.isLoading ||
            affinityQuery.isLoading
          }
          facts={[
            [t('Channel affinity'), affinityValue],
            [
              t('Disk cache'),
              cacheStats
                ? `${t('{{count}} files', { count: cacheStats.active_disk_files ?? 0 })} · ${formatBytes(cacheStats.current_disk_usage_bytes ?? 0, locale)}`
                : '-',
            ],
            [
              t('Memory buffers'),
              cacheStats
                ? `${formatNumber(cacheStats.active_memory_buffers ?? 0, locale)} · ${formatBytes(cacheStats.current_memory_usage_bytes ?? 0, locale)}`
                : '-',
            ],
            [
              'Goroutine',
              typeof goroutines === 'number'
                ? formatNumber(goroutines, locale)
                : '-',
            ],
            [t('Log files'), logFilesValue],
          ]}
        />
      </div>
    </div>
  )
}

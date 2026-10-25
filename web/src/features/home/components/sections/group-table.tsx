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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useHomeFlow, type HomeFlowGroup } from '../../hooks/use-home-flow'
import { getGroupHealth, GROUP_HEALTH_DOT, GROUP_HEALTH_TEXT } from './health'

const SKELETON_WIDTHS = ['w-3/4', 'w-2/5', 'w-1/3', 'w-1/2', 'w-2/3', 'w-3/5']

/**
 * Group ratio comparison: ratio × base price is the billed price, status
 * comes from the last hour. Clicking a row opens pricing filtered by group.
 */
export function GroupTable() {
  const { t } = useTranslation()
  const flow = useHomeFlow()

  return (
    <section className='pt-24'>
      <h2 className='mb-2 text-[30px] font-semibold tracking-tight'>
        {t('Choose price and route by group')}
      </h2>
      <p className='text-subtle-foreground mb-7 text-[14.5px]'>
        {t(
          'Ratio × model base price is the actual charge; status covers the last hour. Click a row to see the models in that group.'
        )}
      </p>
      <div className='bg-card overflow-x-auto rounded-lg border'>
        <GroupTableBody flow={flow} />
      </div>
    </section>
  )
}

function GroupTableBody(props: { flow: ReturnType<typeof useHomeFlow> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const flow = props.flow

  if (flow.status === 'error') {
    return (
      <ErrorState
        title={t('Failed to load groups')}
        onRetry={flow.refetch}
        className='py-10'
      />
    )
  }
  if (flow.status === 'empty') {
    return (
      <EmptyState
        title={t('No groups available')}
        bordered={false}
        className='py-10'
      />
    )
  }

  const openGroup = (group: string) => {
    void navigate({ to: '/pricing', search: { group } })
  }

  return (
    <table className='w-full border-collapse text-sm'>
      <thead>
        <tr className='text-subtle-foreground border-b text-left text-[12.5px] whitespace-nowrap'>
          <th className='px-5 py-3 font-medium'>{t('Group')}</th>
          <th className='px-5 py-3 font-medium'>{t('Ratio')}</th>
          <th className='px-5 py-3 font-medium'>{t('Model count column')}</th>
          <th className='px-5 py-3 font-medium'>{t('1h success rate')}</th>
          <th className='px-5 py-3 font-medium'>{t('Average latency')}</th>
          <th className='px-5 py-3'>
            <span className='sr-only'>{t('Actions')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {flow.status === 'loading'
          ? [0, 1, 2, 3].map((row) => (
              <tr key={row} className='border-b last:border-b-0'>
                {SKELETON_WIDTHS.map((width) => (
                  <td key={width} className='px-5 py-3.5'>
                    <Skeleton className={cn('h-3.5', width)} />
                  </td>
                ))}
              </tr>
            ))
          : flow.groups.map((g) => (
              <GroupRow
                key={g.group}
                group={g}
                noPerf={flow.noPerf}
                onOpen={() => openGroup(g.group)}
              />
            ))}
      </tbody>
    </table>
  )
}

function GroupRow(props: {
  group: HomeFlowGroup
  noPerf: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const g = props.group
  const health = getGroupHealth(g.successRate)
  const hasPerf = !props.noPerf && g.successRate !== null

  return (
    <tr
      tabIndex={0}
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onOpen()
        }
      }}
      className='hover:bg-muted focus-visible:bg-muted cursor-pointer border-b whitespace-nowrap outline-none last:border-b-0'
    >
      <td className='px-5 py-3.5'>
        <div className='flex items-center gap-2.5 font-semibold'>
          <span
            aria-hidden
            className={cn('size-2 rounded-full', GROUP_HEALTH_DOT[health])}
          />
          <span>{g.desc || g.group}</span>
        </div>
      </td>
      <td
        className={cn(
          'px-5 py-3.5 font-mono tabular-nums',
          g.ratio < 1 && 'text-success'
        )}
      >
        ×{g.ratio.toFixed(1)}
      </td>
      <td className='px-5 py-3.5 font-mono tabular-nums'>{g.modelTotal}</td>
      {hasPerf ? (
        <>
          <td
            className={cn(
              'px-5 py-3.5 font-mono tabular-nums',
              GROUP_HEALTH_TEXT[health]
            )}
          >
            {g.successRate?.toFixed(1)}%
          </td>
          <td className='px-5 py-3.5 font-mono tabular-nums'>
            {g.avgLatencyMs === null
              ? '—'
              : `${(g.avgLatencyMs / 1000).toFixed(2)}s`}
          </td>
        </>
      ) : (
        <td colSpan={2} className='text-subtle-foreground px-5 py-3.5'>
          {t('No traffic in the last hour')}
        </td>
      )}
      <td className='text-primary px-5 py-3.5 text-right text-[13px]'>
        {t('View models →')}
      </td>
    </tr>
  )
}

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

import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { toIntlLocale } from '@/i18n/languages'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatLogQuota, formatNumber, formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import { LOG_TYPE_ENUM } from '../constants'
import type { UsageLog } from '../data/schema'
import {
  formatModelName,
  getLogTokenBreakdown,
  parseLogOther,
  renderLogContent,
} from '../lib/format'
import { isPerCallBilling } from '../lib/utils'

const SEGMENTS = [
  { key: 'input', label: 'Input', bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { key: 'cacheRead', label: 'Cache read', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'cacheWrite', label: 'Cache write', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { key: 'output', label: 'Output', bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
] as const

function Box(props: { title: string; children: React.ReactNode }) {
  return (
    <section className='bg-card flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 text-xs'>
      <h4 className='text-muted-foreground mb-0.5 text-[11.5px] font-medium'>
        {props.title}
      </h4>
      {props.children}
    </section>
  )
}

function Row(props: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-3',
        props.strong && 'border-t pt-1.5 font-semibold'
      )}
    >
      <span className='text-muted-foreground'>{props.label}</span>
      <span className='text-right font-mono [overflow-wrap:anywhere] tabular-nums'>
        {props.value}
      </span>
    </div>
  )
}

/**
 * Inline detail row under a desktop common-log row: token mix, per-token
 * cost lines and request facts. The full dialog stays one click away.
 */
export function CommonLogExpandedRow(props: {
  log: UsageLog
  colSpan: number
  onOpenDetails: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { log } = props
  const other = parseLogOther(log.other)
  const model = formatModelName(log)
  const isError = log.type === LOG_TYPE_ENUM.ERROR
  const tokens = getLogTokenBreakdown(log, other)
  const total = tokens.inputTotal + tokens.output
  const frt =
    log.is_stream && other?.frt != null && other.frt > 0
      ? other.frt / 1000
      : undefined
  const generationSeconds = frt != null ? log.use_time - frt : log.use_time
  const tps =
    generationSeconds > 0 && log.completion_tokens > 0
      ? Math.round(log.completion_tokens / generationSeconds)
      : undefined

  // Per-token cost lines only apply to plain ratio billing; dynamic and
  // per-call billing are explained in the full dialog.
  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const ratioBilling =
    other != null &&
    other.billing_mode !== 'tiered_expr' &&
    !isPerCallBilling(other.model_price) &&
    other.model_ratio != null
  const groupRatio =
    other?.user_group_ratio != null && other.user_group_ratio !== -1
      ? other.user_group_ratio
      : other?.group_ratio
  const inputUSD = (other?.model_ratio ?? 0) * 2
  const costLines = ratioBilling
    ? [
        { label: t('Input'), count: tokens.input, price: inputUSD },
        {
          label: t('Cache read'),
          count: tokens.cacheRead,
          price: inputUSD * (other?.cache_ratio ?? 1),
        },
        {
          label: t('Cache write'),
          count: tokens.cacheWrite,
          price: inputUSD * (other?.cache_creation_ratio ?? 1),
        },
        {
          label: t('Output'),
          count: tokens.output,
          price: inputUSD * (other?.completion_ratio ?? 1),
        },
      ].filter((line) => line.count > 0)
    : []

  return (
    <TableRow className='hover:bg-transparent'>
      <TableCell colSpan={props.colSpan} className='bg-muted/30 p-3'>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3'>
          {isError ? (
            <Box title={t('Error')}>
              <Row
                label={t('Status code')}
                value={other?.status_code ?? '—'}
              />
              <p className='text-foreground font-mono text-xs [overflow-wrap:anywhere] whitespace-pre-wrap'>
                {renderLogContent(other, t) ?? log.content ?? '—'}
              </p>
            </Box>
          ) : (
            <Box title={t('Token mix')}>
              <div className='bg-muted flex h-2 overflow-hidden rounded-full'>
                {SEGMENTS.map((segment) =>
                  tokens[segment.key] > 0 && total > 0 ? (
                    <span
                      key={segment.key}
                      className={segment.bar}
                      style={{ width: `${(tokens[segment.key] / total) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
              <div className='flex flex-wrap gap-x-3 gap-y-1'>
                {SEGMENTS.map((segment) => (
                  <span key={segment.key} className={segment.text}>
                    {t(segment.label)}{' '}
                    <span className='font-mono tabular-nums'>
                      {formatNumber(tokens[segment.key], locale)}
                    </span>
                  </span>
                ))}
              </div>
              <Row
                label={t('Cache hit rate')}
                value={
                  tokens.hitRate != null ? `${tokens.hitRate.toFixed(1)}%` : '—'
                }
              />
            </Box>
          )}

          {!isError && (
            <Box title={t('Cost breakdown')}>
              {costLines.map((line) => (
                <Row
                  key={line.label}
                  label={`${line.label} ${formatNumber(line.count, locale)} × ${formatBillingCurrencyFromUSD(line.price, priceOpts)}/M`}
                  value={formatBillingCurrencyFromUSD(
                    (line.count * line.price) / 1e6,
                    priceOpts
                  )}
                />
              ))}
              {groupRatio != null &&
                Number.isFinite(groupRatio) &&
                groupRatio !== 1 && (
                  <Row label={t('Group Ratio')} value={`× ${groupRatio}`} />
                )}
              <Row
                strong
                label={t('Total')}
                value={formatLogQuota(log.quota)}
              />
            </Box>
          )}

          <Box title={t('Request')}>
            <Row label={t('Requested model')} value={model.name || '—'} />
            {model.isMapped && model.actualModel && (
              <Row label={t('Upstream model')} value={model.actualModel} />
            )}
            <Row
              label={t('First token / Total')}
              value={`${frt != null ? formatUseTime(frt) : '—'} / ${formatUseTime(log.use_time)}`}
            />
            {tps != null && <Row label={t('Output speed')} value={`${tps} t/s`} />}
            {log.request_id && (
              <Row label={t('Request ID')} value={log.request_id} />
            )}
            <div className='flex justify-end pt-1'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 text-xs'
                onClick={props.onOpenDetails}
              >
                {t('View full details')}
              </Button>
            </div>
          </Box>
        </div>
      </TableCell>
    </TableRow>
  )
}

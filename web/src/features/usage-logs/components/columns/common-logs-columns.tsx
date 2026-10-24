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
import { Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'
import {
  normalizeTierLabel,
  parseTaskTiersFromExpr,
} from '@/features/pricing/lib/billing-expr'
import {
  formatTaskUsageUnitPrice,
  getTaskUsagePriceUnitLabelKey,
} from '@/features/pricing/lib/dynamic-price'
import { pluginUsageSchema } from '@/features/pricing/lib/plugin-pricing'
import { taskUsageUnitLabel } from '@/features/pricing/lib/task-price-display'
import type { BillingUsageSchema } from '@/features/pricing/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import {
  formatLogQuota,
  formatNumber,
  formatTimestampToDate,
  formatUseTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { LOG_TYPE_ALL_VALUE, LOG_TYPE_ENUM } from '../../constants'
import type { UsageLog } from '../../data/schema'
import {
  formatModelName,
  decodeBillingExprB64,
  getTieredBillingSummary,
  hasAnyCacheTokens,
  parseLogOther,
  isViolationFeeLog,
  logTokenName,
  renderAuditContent,
  renderLogContent,
} from '../../lib/format'
import {
  isDisplayableLogType,
  isTimingLogType,
  getLogTypeConfig,
  isPerCallBilling,
} from '../../lib/utils'
import type { LogOtherData } from '../../types'
import { DetailsDialog } from '../dialogs/details-dialog'
import { LogCostDisplay } from '../log-cost-display'
import { StreamTpsCell } from '../timing-metrics-cell'
import { useUsageLogsContext } from '../usage-logs-provider'

interface DetailSegment {
  text: string
  muted?: boolean
  danger?: boolean
}

function formatRatioCompact(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '-'
  return ratio % 1 === 0
    ? String(ratio)
    : ratio.toFixed(4).replace(/\.?0+$/, '')
}

function buildDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  isAdmin: boolean,
  language: string,
  usageSchema?: BillingUsageSchema
): DetailSegment[] {
  const segments = buildTypeDetailSegments(log, other, t, language, usageSchema)
  const adminSegments: DetailSegment[] = []
  // Quota saturation is a rare, admin-only anomaly marker; surface it first
  // and in danger styling so it stands out on the related billing log. The
  // backend already strips admin_info for non-admins; gate on isAdmin too as
  // defense in depth so the marker never leaks if that changes.
  if (isAdmin && other?.admin_info?.quota_saturation) {
    adminSegments.push({ text: t('Quota clamped'), danger: true })
  }
  return [...adminSegments, ...segments]
}

function buildTypeDetailSegments(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string,
  usageSchema?: BillingUsageSchema
): DetailSegment[] {
  // Top-up, audit, and login logs can carry a localized operation descriptor.
  if (log.type === 1 || log.type === 3 || log.type === 7) {
    const text = renderAuditContent(other, t) ?? renderLogContent(other, t)
    return text ? [{ text }] : []
  }

  if (log.type === 6) {
    return [{ text: t('Async task refund') }]
  }

  if (log.type !== 2) return []

  const isViolation = isViolationFeeLog(other)
  if (isViolation) {
    const segments: DetailSegment[] = []
    segments.push({ text: t('Violation Fee'), danger: true })
    if (other?.violation_fee_code) {
      segments.push({
        text: other.violation_fee_code,
        muted: true,
      })
    }
    segments.push({
      text: `${t('Fee')}: ${formatLogQuota(other?.fee_quota ?? log.quota)}`,
      muted: true,
    })
    return segments
  }

  if (!other) return []

  const segments: DetailSegment[] = []

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const formatPrice = (price: number) =>
    `${formatBillingCurrencyFromUSD(price, priceOpts)}/M`
  const formatPriceCompact = (price: number) =>
    formatBillingCurrencyFromUSD(price, priceOpts)
  const formatPriceList = (prices: string[], showUnit: boolean) => {
    const text = prices.join(' / ')
    return showUnit ? `${text}/M` : text
  }
  const isTieredExpr = other.billing_mode === 'tiered_expr'
  const tieredSummary = getTieredBillingSummary(other)
  if (isTieredExpr && other.is_task) {
    const tiers = parseTaskTiersFromExpr(
      decodeBillingExprB64(other.expr_b64),
      usageSchema,
      true
    )
    const tier = tiers.find(
      (entry) =>
        Boolean(other.matched_tier) &&
        normalizeTierLabel(entry.label) ===
          normalizeTierLabel(other.matched_tier)
    )
    if (tier) {
      const prices = Object.entries(tier.unitPrices).map(([field, price]) => {
        const definition = usageSchema?.[field]
        const unitKey = getTaskUsagePriceUnitLabelKey(definition?.unit)
        const unitLabel = taskUsageUnitLabel(definition, language, t(unitKey))
        return `${field} ${formatTaskUsageUnitPrice(price, { tokenUnit: 'M' })}/${unitLabel}`
      })
      if (tier.constant > 0) {
        prices.push(
          `${t('Additional charge')} ${formatTaskUsageUnitPrice(tier.constant, { tokenUnit: 'M' })}/${t('request')}`
        )
      }
      segments.push({
        text: `${tier.label || t('Default')} · ${prices.join(' · ')}`,
      })
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${other.matched_tier || t('Special billing expression')}`,
        muted: true,
      })
    }
  } else if (isTieredExpr) {
    if (tieredSummary) {
      const baseEntries = tieredSummary.priceEntries
        .filter((entry) => ['inputPrice', 'outputPrice'].includes(entry.field))
        .map((entry) => formatPriceCompact(entry.price))
      if (baseEntries.length > 0) {
        const tierLabel = tieredSummary.tier.label || t('Default')
        segments.push({
          text: `${tierLabel} · ${formatPriceList(baseEntries, true)}`,
        })
      }

      const cacheEntries = tieredSummary.priceEntries
        .filter((entry) =>
          ['cacheReadPrice', 'cacheCreatePrice', 'cacheCreate1hPrice'].includes(
            entry.field
          )
        )
        .map((entry) => {
          return formatPriceCompact(entry.price)
        })
      if (cacheEntries.length > 0) {
        segments.push({
          text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
          muted: true,
        })
      }

      const otherEntries = tieredSummary.priceEntries
        .filter(
          (entry) =>
            ![
              'inputPrice',
              'outputPrice',
              'cacheReadPrice',
              'cacheCreatePrice',
              'cacheCreate1hPrice',
            ].includes(entry.field)
        )
        .map((entry) =>
          entry.unit
            ? `${tieredSummary.tier.label || t('Default')} · ${t(entry.shortLabel)} ${formatPriceCompact(entry.price)}/${t(entry.unit)}`
            : `${t(entry.shortLabel)} ${formatPrice(entry.price)}`
        )
      if (otherEntries.length > 0) {
        segments.push({
          text: otherEntries.join(' · '),
          muted: true,
        })
      }
    } else {
      segments.push({
        text: `${t('Dynamic Pricing')} · ${other.matched_tier || t('Special billing expression')}`,
        muted: true,
      })
    }
  } else {
    const modelPrice = other.model_price
    const isPerCall = isPerCallBilling(modelPrice)
    if (isPerCall && modelPrice != null) {
      segments.push({
        text: `${t('Per-call')} · ${formatBillingCurrencyFromUSD(modelPrice, priceOpts)}`,
      })
    } else if (other.model_ratio != null) {
      const inputPriceUSD = other.model_ratio * 2.0
      const baseEntries = [formatPriceCompact(inputPriceUSD)]
      if (other.completion_ratio != null) {
        baseEntries.push(
          formatPriceCompact(inputPriceUSD * other.completion_ratio)
        )
      }
      segments.push({
        text: `${t('Standard')} · ${formatPriceList(baseEntries, true)}`,
      })

      if (hasAnyCacheTokens(other)) {
        const cacheEntries = [
          other.cache_ratio != null && other.cache_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_ratio)
            : null,
          other.cache_creation_ratio != null && other.cache_creation_ratio !== 1
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio)
            : null,
          other.cache_creation_ratio_1h != null &&
          other.cache_creation_ratio_1h !== 0
            ? formatPriceCompact(inputPriceUSD * other.cache_creation_ratio_1h)
            : null,
        ].filter(Boolean) as string[]

        if (cacheEntries.length > 0) {
          segments.push({
            text: `${t('Cache')} ${formatPriceList(cacheEntries, false)}`,
            muted: true,
          })
        }
      }
    } else {
      const userGroupRatio = other.user_group_ratio
      const groupRatio = other.group_ratio
      const isUserGroup =
        userGroupRatio != null &&
        Number.isFinite(userGroupRatio) &&
        userGroupRatio !== -1
      const effectiveRatio = isUserGroup ? userGroupRatio : groupRatio
      const ratioLabel = isUserGroup
        ? t('User Exclusive Ratio')
        : t('Group Ratio')

      if (effectiveRatio != null && Number.isFinite(effectiveRatio)) {
        segments.push({
          text: `${ratioLabel} ${formatRatioCompact(effectiveRatio)}x`,
        })
      }
    }
  }

  if (other.is_system_prompt_overwritten) {
    segments.push({
      text: t('System Prompt Override'),
      danger: true,
    })
  }

  return segments
}

const numericCellClass = 'font-mono! text-[12.5px]! tabular-nums'
const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs! font-medium! whitespace-nowrap'

export function useCommonLogsColumns(
  isAdmin: boolean,
  isRoot: boolean,
  showBillingSource = false
): ColumnDef<UsageLog>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const currency = useSystemConfigStore((state) => state.config.currency)
  return useMemo(() => {
    const columns: ColumnDef<UsageLog>[] = [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => (
          <span
            className='text-muted-foreground font-mono! text-xs!'
            title={formatTimestampToDate(row.original.created_at)}
          >
            {dayjs.unix(row.original.created_at).format('HH:mm:ss')}
          </span>
        ),
        filterFn: (row, _id, value) => {
          if (!Array.isArray(value) || value.length === 0) return true
          if (value.includes(LOG_TYPE_ALL_VALUE)) return true
          return value.includes(String(row.original.type))
        },
        enableHiding: false,
      },
    ]

    if (isAdmin) {
      columns.push({
        id: 'user',
        header: t('User'),
        accessorFn: (row) => row.username,
        cell: function UserCell({ row }) {
          const context = useUsageLogsContext()
          const log = row.original
          if (!log.username) return null

          return (
            <button
              type='button'
              className='text-left hover:underline'
              onClick={(e) => {
                e.stopPropagation()
                context.setSelectedUserId(log.user_id)
                context.setUserInfoDialogOpen(true)
              }}
            >
              {context.sensitiveVisible ? log.username : '••••'}
            </button>
          )
        },
        filterFn: () => true,
      })
    }

    columns.push(
      {
        accessorKey: 'token_name',
        header: t('Key'),
        cell: function TokenNameCell({ row }) {
          const { sensitiveVisible } = useUsageLogsContext()
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          const tokenName = logTokenName(log, t)
          if (!tokenName) return null
          return <span>{sensitiveVisible ? tokenName : '••••'}</span>
        },
      },
      {
        accessorKey: 'model_name',
        header: t('Model'),
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          const modelInfo = formatModelName(log)
          return (
            <span
              className='font-mono! text-[12.5px]!'
              title={modelInfo.actualModel || modelInfo.name}
            >
              {modelInfo.name}
            </span>
          )
        },
        meta: { mobileTitle: true },
      },
      {
        id: 'group',
        header: t('Group'),
        accessorFn: (row) => row.group,
        cell: function GroupCell({ row }) {
          const { sensitiveVisible } = useUsageLogsContext()
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          const group = log.group || parseLogOther(log.other)?.group || ''
          if (!group) return null
          return (
            <span className={cn(tagClass, 'bg-muted text-muted-foreground')}>
              {sensitiveVisible ? group : '••••'}
            </span>
          )
        },
      },
      {
        id: 'log_type',
        header: t('Type'),
        cell: ({ row }) => {
          const log = row.original
          const config = getLogTypeConfig(log.type)
          const other = parseLogOther(log.other)
          if (log.type !== LOG_TYPE_ENUM.ERROR) {
            let label: string = config.label
            if (log.type === LOG_TYPE_ENUM.CONSUME) {
              // Consume rows name the request kind, read from the relay path.
              const path = other?.request_path ?? ''
              label = 'Conversation'
              if (path.includes('/embeddings')) label = 'Embedding'
              if (path.includes('/images')) label = 'Drawing'
            }
            return (
              <span className={cn(tagClass, 'bg-muted text-muted-foreground')}>
                {t(label)}
              </span>
            )
          }
          const retried = (other?.admin_info?.use_channel?.length ?? 0) > 1
          const label = [
            t(config.label),
            other?.status_code,
            retried ? t('Retried') : null,
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <span className={cn(tagClass, 'bg-warning/12 text-warning')}>
              <span
                className='size-1.5 rounded-full bg-current'
                aria-hidden='true'
              />
              {label}
            </span>
          )
        },
      },
      {
        accessorKey: 'prompt_tokens',
        header: t('Input'),
        cell: ({ row }) => {
          const log = row.original
          return (
            <span className={numericCellClass}>
              {isDisplayableLogType(log.type)
                ? formatNumber(log.prompt_tokens || 0, locale)
                : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'completion_tokens',
        header: t('Output'),
        cell: ({ row }) => {
          const log = row.original
          return (
            <span className={numericCellClass}>
              {isDisplayableLogType(log.type)
                ? formatNumber(log.completion_tokens || 0, locale)
                : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'use_time',
        header: t('First token / Total'),
        cell: ({ row }) => {
          const log = row.original
          if (!isTimingLogType(log.type)) {
            return <span className={numericCellClass}>—</span>
          }
          const frt = parseLogOther(log.other)?.frt
          const firstToken =
            log.is_stream && frt != null && frt > 0
              ? formatUseTime(frt / 1000)
              : '—'
          return (
            <span className={numericCellClass}>
              {firstToken} / {formatUseTime(log.use_time)}
            </span>
          )
        },
      },
      {
        accessorKey: 'quota',
        header: t('Cost'),
        cell: ({ row }) => {
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          return (
            <LogCostDisplay
              plain
              quota={log.quota}
              other={parseLogOther(log.other)}
              showBillingSource={showBillingSource}
            />
          )
        },
      }
    )

    if (isAdmin) {
      columns.push({
        id: 'channel',
        header: t('Channel'),
        accessorFn: (row) => row.channel,
        cell: function ChannelCell({ row }) {
          const context = useUsageLogsContext()
          const log = row.original
          if (!isDisplayableLogType(log.type)) return null
          const affinity = parseLogOther(log.other)?.admin_info
            ?.channel_affinity
          const channelName =
            context.sensitiveVisible && log.channel_name
              ? log.channel_name
              : `#${log.channel}`

          return (
            <span className='inline-flex items-center gap-1'>
              <span className='font-mono! text-xs!' title={`#${log.channel}`}>
                {channelName}
              </span>
              {affinity && (
                <button
                  type='button'
                  aria-label={t('Channel Affinity')}
                  className='leading-none text-amber-500'
                  onClick={(e) => {
                    e.stopPropagation()
                    context.setAffinityTarget({
                      rule_name: affinity.rule_name || '',
                      using_group:
                        affinity.using_group || affinity.selected_group || '',
                      key_hint: affinity.key_hint || '',
                      key_fp: affinity.key_fp || '',
                    })
                    context.setAffinityDialogOpen(true)
                  }}
                >
                  <Sparkles className='size-3 fill-current' />
                </button>
              )}
            </span>
          )
        },
        filterFn: () => true,
      })
    }

    // Stream and details only feed the mobile cards; the desktop table hides
    // them and opens details from the row instead.
    columns.push(
      {
        accessorKey: 'is_stream',
        header: t('Stream'),
        cell: ({ row }) => {
          const log = row.original
          if (!isTimingLogType(log.type)) return null

          const other = parseLogOther(log.other)
          const tokensPerSecond =
            log.use_time > 0 && log.completion_tokens > 0
              ? log.completion_tokens / log.use_time
              : null

          return (
            <StreamTpsCell
              isStream={log.is_stream}
              isTask={other?.is_task === true}
              isSyncTask={other?.task_sync === true}
              tokensPerSecond={tokensPerSecond}
              streamStatus={other?.stream_status}
            />
          )
        },
        meta: { label: t('Stream') },
      },
      {
        accessorKey: 'content',
        header: t('Details'),
        cell: function DetailsCell({ row }) {
          const { t, i18n } = useTranslation()
          const [dialogOpen, setDialogOpen] = useState(false)
          const log = row.original
          const other = parseLogOther(log.other)

          const pricingData = usePricingData(
            log.type === 2 &&
              other?.is_task === true &&
              other.billing_mode === 'tiered_expr'
          )
          const usageSchema = pluginUsageSchema(
            pricingData.models.find(
              (model) => model.model_name === log.model_name
            ),
            other?.admin_info?.task_plugin?.key
          )
          const segments = buildDetailSegments(
            log,
            other,
            t,
            isAdmin,
            i18n.language,
            usageSchema
          )
          const primary = segments[0]
          const hasMore = segments.length > 1
          let primaryTextClass = 'text-foreground'
          if (primary?.muted) {
            primaryTextClass = 'text-muted-foreground/60'
          } else if (primary?.danger) {
            primaryTextClass = 'text-red-600 dark:text-red-400'
          }
          let detailPreview = (
            <span className='text-muted-foreground/40'>—</span>
          )
          if (primary) {
            detailPreview = (
              <span
                className={cn(
                  'truncate leading-snug group-hover:underline',
                  primaryTextClass
                )}
              >
                {primary.text}
                {hasMore && (
                  <span className='text-muted-foreground/40 ml-0.5'>
                    +{segments.length - 1}
                  </span>
                )}
              </span>
            )
          } else if (log.content) {
            detailPreview = (
              <span className='text-muted-foreground truncate group-hover:underline'>
                {renderLogContent(other, t) ?? log.content}
              </span>
            )
          }

          return (
            <>
              <button
                type='button'
                className='group flex max-w-[200px] items-center gap-1 text-left text-xs'
                onClick={() => setDialogOpen(true)}
                title={t('Click to view full details')}
              >
                {detailPreview}
              </button>
              <DetailsDialog
                log={log}
                isAdmin={isAdmin}
                isRoot={isRoot}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
              />
            </>
          )
        },
        size: 180,
        maxSize: 200,
      }
    )

    return columns
    // Log formatters read currency settings from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, locale, isAdmin, isRoot, showBillingSource, currency])
}

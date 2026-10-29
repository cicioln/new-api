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
/* eslint-disable react-refresh/only-export-components */
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useContext, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatCurrencyFromUSD, formatQuotaWithCurrency } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getCodexUsage, updateChannelBalance } from '../api'
import {
  CHANNEL_STATUS,
  CHANNEL_TYPE_SGLANG,
  CHANNEL_TYPE_TASK_PLUGIN,
  CHANNEL_TYPE_VLLM,
} from '../constants'
import {
  channelsQueryKeys,
  formatMaintenanceUntil,
  getChannelDisplayStatus,
  getChannelMaintenance,
  getChannelTypeLabel,
  handleTestChannel,
  parseGroupsList,
} from '../lib'
import type { Channel } from '../types'
import { ChannelRowActionsLayoutContext } from './channel-row-actions-context'
import { useChannels } from './channels-provider'
import { DataTableRowActions } from './data-table-row-actions'
import { BalanceQueryDialog } from './dialogs/balance-query-dialog'
import {
  CodexUsageDialog,
  type CodexUsageDialogData,
} from './dialogs/codex-usage-dialog'

const CHANNEL_TYPE_CODEX = 57
const numericCellClass = 'font-mono! text-[12.5px]! tabular-nums'
const statusTagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs! font-medium! whitespace-nowrap'

function parseStatusDetails(channel: Channel) {
  if (channel.status !== CHANNEL_STATUS.AUTO_DISABLED || !channel.other_info) {
    return null
  }
  try {
    const otherInfo = JSON.parse(channel.other_info)
    const reason: string = otherInfo?.status_reason || ''
    const time = otherInfo?.status_time
      ? formatTimestampToDate(otherInfo.status_time)
      : ''
    return reason || time ? { reason, time } : null
  } catch {
    return null
  }
}

function ChannelStatusCell(props: { channel: Channel }) {
  const { t } = useTranslation()
  const status = getChannelDisplayStatus(props.channel)
  const details = parseStatusDetails(props.channel)
  const tag = (
    <span className={cn(statusTagClass, status.className)}>
      <span className='size-1.5 rounded-full bg-current' aria-hidden='true' />
      {t(status.label)}
    </span>
  )
  const maintenance = getChannelMaintenance(props.channel)
  if (maintenance) {
    const recovery = maintenance.until
      ? t('Expected recovery {{time}}', {
          time: formatMaintenanceUntil(maintenance.until),
        })
      : t('No recovery time set')
    const hint = maintenance.note
      ? `${maintenance.note} · ${recovery}`
      : recovery
    return (
      <div className='flex min-w-0 flex-col items-start gap-0.5'>
        {tag}
        <span
          className='text-muted-foreground max-w-[200px] truncate text-[11px]'
          title={hint}
        >
          {hint}
        </span>
      </div>
    )
  }
  if (!details) return tag

  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger render={<span />}>{tag}</TooltipTrigger>
        <TooltipContent side='top' className='max-w-xs'>
          <div className='space-y-1 text-xs'>
            {details.reason && (
              <div className='wrap-anywhere'>
                {t('Reason:')} {translateServerText(t, details.reason)}
              </div>
            )}
            {details.time && (
              <div>
                {t('Time:')} {details.time}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Response column text: milliseconds, seconds, "Timeout" or an em dash. */
function ChannelResponseCell(props: { channel: Channel }) {
  const { t } = useTranslation()
  const responseTime = props.channel.response_time
  if (props.channel.status === CHANNEL_STATUS.AUTO_DISABLED && responseTime) {
    return <span className={numericCellClass}>{t('Timeout')}</span>
  }
  if (!responseTime) {
    return <span className={numericCellClass}>—</span>
  }
  const text =
    responseTime < 1000
      ? `${responseTime}ms`
      : `${Number((responseTime / 1000).toFixed(1))}s`
  return <span className={numericCellClass}>{text}</span>
}

/**
 * Used / balance cell. Clicking the balance refreshes it from the upstream;
 * Codex and inference channels open their own status dialogs instead.
 */
export function BalanceCell({ channel }: { channel: Channel }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const layout = useContext(ChannelRowActionsLayoutContext)
  const { setCurrentRow, setOpen } = useChannels()
  const [isUpdating, setIsUpdating] = useState(false)
  const [rawBalanceResponse, setRawBalanceResponse] = useState<string | null>(
    null
  )
  const [codexUsageOpen, setCodexUsageOpen] = useState(false)
  const [codexUsageResponse, setCodexUsageResponse] =
    useState<CodexUsageDialogData | null>(null)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const isCodex = channel.type === CHANNEL_TYPE_CODEX
  const isInferenceChannel =
    channel.type === CHANNEL_TYPE_VLLM || channel.type === CHANNEL_TYPE_SGLANG
  const inferenceStatusLabel =
    channel.type === CHANNEL_TYPE_SGLANG ? t('SGLang status') : t('vLLM status')

  const used = formatQuotaWithCurrency(channel.used_quota || 0, {
    digitsLarge: 2,
    minimumFractionDigits: 2,
    locale,
    showSymbol: layout !== 'card',
  })
  // Balances that were never queried show as unlimited, as in the design.
  const balance = channel.balance_updated_time
    ? formatCurrencyFromUSD(channel.balance, {
        digitsLarge: 2,
        minimumFractionDigits: 2,
        locale,
        showSymbol: layout !== 'card',
      })
    : '∞'

  const loadCodexUsage = async () => {
    const res = await getCodexUsage(channel.id)
    if (!res.success) {
      throw createServerError(res, t('Failed to fetch usage'))
    }
    setCodexUsageResponse(res)
  }

  const handleClick = async () => {
    if (isInferenceChannel) {
      setCurrentRow(channel)
      setOpen('inference-status')
      return
    }
    if (isUpdating) return
    setIsUpdating(true)
    try {
      if (isCodex) {
        await loadCodexUsage()
        setCodexUsageOpen(true)
        return
      }
      const response = await updateChannelBalance(channel.id)
      if (response.success && response.balance !== undefined) {
        toast.success(
          t('Balance updated: {{balance}}', {
            balance: formatCurrencyFromUSD(response.balance, {
              digitsLarge: 2,
              digitsSmall: 4,
              abbreviate: false,
            }),
          })
        )
        void queryClient.invalidateQueries({
          queryKey: channelsQueryKeys.lists(),
        })
      } else if (response.success && response.raw_response !== undefined) {
        setCurrentRow(channel)
        setRawBalanceResponse(response.raw_response)
      } else {
        handleServerError(response, t('Failed to update balance'))
      }
    } catch (error: unknown) {
      handleServerError(
        error,
        isCodex ? t('Failed to fetch usage') : t('Failed to update balance')
      )
    } finally {
      setIsUpdating(false)
    }
  }

  let balanceLabel = balance
  let tooltipLabel = t('Click to update balance')
  if (isCodex) {
    balanceLabel = t('Account Info')
    tooltipLabel = t('Click to view Codex usage')
  } else if (isInferenceChannel) {
    balanceLabel = inferenceStatusLabel
    tooltipLabel = inferenceStatusLabel
  }

  return (
    <TooltipProvider>
      <span className={cn(numericCellClass, 'whitespace-nowrap')}>
        {used} /{' '}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type='button'
                className='hover:text-foreground cursor-pointer underline-offset-4 hover:underline'
                aria-haspopup={isInferenceChannel ? 'dialog' : undefined}
                aria-busy={isUpdating}
                onClick={handleClick}
              />
            }
          >
            {isUpdating ? t('Updating...') : balanceLabel}
          </TooltipTrigger>
          <TooltipContent>{tooltipLabel}</TooltipContent>
        </Tooltip>
      </span>

      <CodexUsageDialog
        open={codexUsageOpen}
        onOpenChange={setCodexUsageOpen}
        channelName={channel.name}
        channelId={channel.id}
        response={codexUsageResponse}
        onRefresh={async () => {
          if (isUpdating) return
          setIsUpdating(true)
          try {
            await loadCodexUsage()
          } catch (error) {
            handleServerError(error, t('Failed to fetch usage'))
          } finally {
            setIsUpdating(false)
          }
        }}
        isRefreshing={isUpdating}
      />
      {rawBalanceResponse !== null && (
        <BalanceQueryDialog
          initialRawResponse={rawBalanceResponse}
          open
          onOpenChange={(open) => {
            if (!open) setRawBalanceResponse(null)
          }}
        />
      )}
    </TooltipProvider>
  )
}

/** The outline "Test" button of a row; runs one connection test in place. */
function ChannelTestButton(props: { channel: Channel }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isTesting, setIsTesting] = useState(false)

  return (
    <Button
      variant='outline'
      size='sm'
      disabled={isTesting}
      aria-busy={isTesting}
      onClick={async (e) => {
        e.stopPropagation()
        setIsTesting(true)
        try {
          await handleTestChannel(
            props.channel.id,
            { channelName: props.channel.name },
            () => {
              void queryClient.invalidateQueries({
                queryKey: channelsQueryKeys.lists(),
              })
            }
          )
        } finally {
          setIsTesting(false)
        }
      }}
    >
      {isTesting && <Loader2 className='animate-spin' aria-hidden='true' />}
      {t('Test')}
    </Button>
  )
}

/**
 * Generate channels columns configuration
 */
export function useChannelsColumns(): ColumnDef<Channel>[] {
  const { t } = useTranslation()
  // Memoizing keeps every cell renderer reference stable across unrelated
  // re-renders, so react-table does not rebuild the row model each time.
  return useMemo<ColumnDef<Channel>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label={t('Select all')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('Select row')}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        size: 40,
      },
      {
        accessorKey: 'id',
        size: 50,
        header: t('ID'),
        cell: ({ row }) => (
          <span className='text-subtle-foreground! font-mono! text-[12.5px]! tabular-nums'>
            {row.original.id}
          </span>
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'name',
        size: 140,
        header: t('Name'),
        cell: ({ row }) => (
          <span className='font-mono! text-[12.5px]!'>{row.original.name}</span>
        ),
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'type',
        size: 120,
        header: t('Type'),
        cell: ({ row }) =>
          row.original.type === CHANNEL_TYPE_TASK_PLUGIN
            ? t('Task Plugin')
            : t(getChannelTypeLabel(row.original.type)),
        filterFn: (row, id, value) => value.includes(String(row.getValue(id))),
      },
      {
        accessorKey: 'status',
        size: 110,
        header: t('Status'),
        cell: ({ row }) => <ChannelStatusCell channel={row.original} />,
        meta: { mobileBadge: true },
      },
      {
        accessorKey: 'group',
        size: 160,
        header: t('Groups'),
        cell: ({ row }) => (
          <span className='text-subtle-foreground!'>
            {parseGroupsList(row.original.group).join(', ')}
          </span>
        ),
        filterFn: (row, id, value) =>
          parseGroupsList(row.getValue(id) as string).some((group) =>
            value.includes(group)
          ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'tag',
        header: t('Tag'),
        enableHiding: true,
      },
      {
        accessorKey: 'priority',
        size: 100,
        header: t('Priority / Weight'),
        cell: ({ row }) => (
          <span className={numericCellClass}>
            {row.original.priority ?? 0} / {row.original.weight ?? 0}
          </span>
        ),
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'response_time',
        size: 80,
        header: t('Response'),
        cell: ({ row }) => <ChannelResponseCell channel={row.original} />,
        meta: { mobileHidden: true },
      },
      {
        accessorKey: 'balance',
        size: 140,
        header: t('Used / Balance'),
        cell: ({ row }) => <BalanceCell channel={row.original} />,
      },
      {
        id: 'actions',
        header: () => <span className='sr-only'>{t('Actions')}</span>,
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            <ChannelTestButton channel={row.original} />
            <DataTableRowActions row={row} />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [t]
  )
}

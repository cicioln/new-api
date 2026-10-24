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

import { TruncatedCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import type { AuditLog } from '../api'
import { auditRowText } from '../lib/audit-row'
import { AuditLogDetailsDialog } from './audit-log-details-dialog'

const tagClass =
  'inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs! font-medium! whitespace-nowrap'

/**
 * Columns of the audit table. The audit page follows the design (time,
 * operator, action, object, IP, client, result) and opens details on row
 * click; the access history drawer keeps request columns and a details button.
 */
export function useAuditLogColumns(
  accessOnly?: boolean
): ColumnDef<AuditLog>[] {
  const { t } = useTranslation()
  return useMemo(() => {
    const result: ColumnDef<AuditLog> = {
      accessorKey: 'success',
      header: t('Result'),
      size: 96,
      cell: ({ row }) => (
        <span
          className={cn(
            tagClass,
            row.original.success
              ? 'bg-success/12 text-success'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          <span aria-hidden className='size-1.5 rounded-full bg-current' />
          {row.original.success ? t('Success') : t('Blocked')}
        </span>
      ),
      meta: { label: t('Result'), mobileBadge: true },
    }
    const details: ColumnDef<AuditLog> = {
      id: 'details',
      header: t('Details'),
      size: 70,
      enableHiding: false,
      cell: ({ row }) => <AuditLogDetailsDialog entry={row.original} />,
      meta: { label: t('Details') },
    }
    if (!accessOnly) {
      return [
        {
          accessorKey: 'created_at',
          header: t('Time'),
          cell: ({ row }) => (
            <span
              className='text-muted-foreground font-mono! text-xs! tabular-nums'
              title={dayjs
                .unix(row.original.created_at)
                .format('YYYY-MM-DD HH:mm:ss')}
            >
              {dayjs.unix(row.original.created_at).format('MM-DD HH:mm')}
            </span>
          ),
          meta: { label: t('Time'), mobileTitle: true },
        },
        {
          accessorKey: 'username',
          header: t('Operator'),
          cell: ({ row }) => <span>{row.original.username || '—'}</span>,
          meta: { label: t('Operator') },
        },
        {
          id: 'action',
          header: t('Action'),
          accessorFn: (entry) => auditRowText(entry, t).action,
          cell: ({ row }) => {
            const text = auditRowText(row.original, t)
            return (
              <div className='flex min-w-0 items-baseline gap-1'>
                <TruncatedCell className='min-w-0'>{text.action}</TruncatedCell>
                {text.identifier && (
                  <span className='text-muted-foreground shrink-0 whitespace-nowrap'>
                    {text.identifier}
                  </span>
                )}
              </div>
            )
          },
          meta: { label: t('Action') },
        },
        {
          id: 'object',
          header: t('Object'),
          accessorFn: (entry) => auditRowText(entry, t).object,
          cell: ({ getValue }) => (
            <TruncatedCell
              className='text-muted-foreground max-w-72'
              contentClassName='line-clamp-2 whitespace-normal break-words'
            >
              {getValue<string>() || '—'}
            </TruncatedCell>
          ),
          meta: { label: t('Object') },
        },
        {
          accessorKey: 'ip',
          header: 'IP',
          cell: ({ row }) => (
            <span className='font-mono! text-xs!'>
              {row.original.ip || '—'}
            </span>
          ),
          meta: { label: 'IP' },
        },
        {
          id: 'client',
          header: t('Client'),
          accessorFn: (entry) => auditRowText(entry, t).client,
          cell: ({ row, getValue }) => (
            <span
              className='text-muted-foreground whitespace-nowrap'
              title={row.original.user_agent || undefined}
            >
              {getValue<string>()}
            </span>
          ),
          meta: { label: t('Client'), mobileHidden: true },
        },
        result,
        // Only mobile cards show this; desktop rows open details on click.
        details,
      ]
    }
    return [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        size: 180,
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {dayjs.unix(row.original.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        ),
        meta: { label: t('Time'), mobileTitle: true },
      },
      {
        accessorKey: 'ip',
        header: 'IP',
        size: 120,
        cell: ({ row }) => (
          <span className='font-mono'>{row.original.ip || '—'}</span>
        ),
        meta: { label: 'IP' },
      },
      {
        accessorKey: 'user_agent',
        header: t('Client'),
        size: 180,
        cell: ({ row }) => (
          <TruncatedCell className='max-w-48'>
            {row.original.user_agent || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Client'), mobileHidden: true },
      },
      {
        accessorKey: 'method',
        header: t('Method'),
        size: 76,
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono'>
            {row.original.method || '—'}
          </span>
        ),
        meta: { label: t('Method') },
      },
      {
        accessorKey: 'route',
        header: t('Route'),
        size: 220,
        cell: ({ row }) => (
          <TruncatedCell className='max-w-60 font-mono'>
            {row.original.route || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Route') },
      },
      {
        accessorKey: 'status',
        header: 'HTTP',
        size: 60,
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {row.original.status || '—'}
          </span>
        ),
        meta: { label: 'HTTP' },
      },
      {
        accessorKey: 'success',
        header: t('Result'),
        size: 82,
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.success ? t('Success') : t('Failed')}
            variant={row.original.success ? 'success' : 'danger'}
            copyable={false}
          />
        ),
        meta: { label: t('Result'), mobileBadge: true },
      },
      details,
    ]
  }, [accessOnly, t])
}

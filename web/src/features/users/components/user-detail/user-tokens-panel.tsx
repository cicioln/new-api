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
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import type { AdminUserToken } from '../../types'

const TOKEN_STATUS: Record<number, { label: string; variant: StatusVariant }> =
  {
    1: { label: 'Enabled', variant: 'success' },
    2: { label: 'Disabled', variant: 'neutral' },
    3: { label: 'Expired', variant: 'warning' },
    4: { label: 'Exhausted', variant: 'warning' },
  }

export function UserTokensPanel(props: {
  tokens: AdminUserToken[]
  total: number
}) {
  const { t } = useTranslation()

  if (props.tokens.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t('This user has no tokens')}
        className='min-h-[200px]'
      />
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Group in effect')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Model Limits')}</TableHead>
              <TableHead>{t('Remaining quota')}</TableHead>
              <TableHead>{t('Last Used')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.tokens.map((token) => {
              const status = TOKEN_STATUS[token.status] ?? {
                label: 'Unknown',
                variant: 'neutral' as const,
              }
              return (
                <TableRow key={token.id}>
                  <TableCell className='whitespace-nowrap'>
                    <span className='font-medium'>{token.name}</span>{' '}
                    <span className='text-muted-foreground font-mono text-xs'>
                      #{token.id}
                    </span>
                    <div className='text-muted-foreground font-mono text-xs'>
                      {token.key}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap items-center gap-1'>
                      <GroupBadge group={token.effective_group} />
                      {token.inherits_user_group && (
                        <StatusBadge
                          label={t('Uses the user group')}
                          variant='warning'
                          copyable={false}
                        />
                      )}
                      {!token.token_group_usable && (
                        <StatusBadge
                          label={t('Group not available')}
                          variant='danger'
                          copyable={false}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={t(status.label)}
                      variant={status.variant}
                      copyable={false}
                    />
                  </TableCell>
                  <TableCell className='max-w-[200px] truncate text-xs'>
                    {token.model_limits_enabled
                      ? token.model_limits || t('No models allowed')
                      : t('Off')}
                  </TableCell>
                  <TableCell className='font-mono text-xs whitespace-nowrap tabular-nums'>
                    {token.unlimited_quota
                      ? t('Unlimited')
                      : formatQuota(token.remain_quota)}
                  </TableCell>
                  <TableCell className='text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums'>
                    {formatTimestampToDate(token.accessed_time)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className='text-muted-foreground text-xs'>
        {props.total > props.tokens.length
          ? t('Showing {{shown}} of {{total}} tokens. Keys are masked.', {
              shown: props.tokens.length,
              total: props.total,
            })
          : t('Keys are masked.')}
      </p>
    </div>
  )
}

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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge, GroupMultiplierBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { UserGroupOverview } from '../../types'

const MODELS_SHOWN = 6

export function UserGroupsPanel(props: { groups: UserGroupOverview[] }) {
  const { t } = useTranslation()
  const [modelQuery, setModelQuery] = useState('')
  const query = modelQuery.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    if (!query) return props.groups
    return props.groups.filter((group) =>
      group.models.some((name) => name.toLowerCase().includes(query))
    )
  }, [props.groups, query])

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='user-groups-model-search'>
          {t('Find groups by model')}
        </Label>
        <Input
          id='user-groups-model-search'
          value={modelQuery}
          onChange={(event) => setModelQuery(event.target.value)}
          placeholder={t('For example muse-video')}
        />
      </div>
      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Ratio')}</TableHead>
              <TableHead>{t('Channels')}</TableHead>
              <TableHead>{t('Models')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleGroups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground py-6 text-center'
                >
                  {t('No group this user may select serves this model')}
                </TableCell>
              </TableRow>
            )}
            {visibleGroups.map((group) => {
              const matched = query
                ? group.models.filter((name) =>
                    name.toLowerCase().includes(query)
                  )
                : group.models
              const shown = matched.slice(0, MODELS_SHOWN)
              return (
                <TableRow key={group.group}>
                  <TableCell className='whitespace-nowrap'>
                    <div className='flex items-center gap-1'>
                      <GroupBadge group={group.group} />
                      {group.is_user_group && (
                        <StatusBadge
                          label={t('User group')}
                          variant='info'
                          copyable={false}
                        />
                      )}
                    </div>
                    {group.description && group.description !== group.group && (
                      <div className='text-muted-foreground max-w-[220px] truncate text-xs'>
                        {t(group.description)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <GroupMultiplierBadge ratio={group.ratio} />
                  </TableCell>
                  <TableCell className='font-mono text-xs tabular-nums'>
                    {group.channels}
                  </TableCell>
                  <TableCell className='text-xs'>
                    {shown.length === 0
                      ? '-'
                      : shown.join(', ') +
                        (matched.length > shown.length
                          ? ` ${t('and {{count}} more', {
                              count: matched.length - shown.length,
                            })}`
                          : '')}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          'A token without a group uses the user group. The user can pick any group listed here on their token.'
        )}
      </p>
    </div>
  )
}

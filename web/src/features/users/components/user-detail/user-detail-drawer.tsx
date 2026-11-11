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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatQuota, formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUserGroupsByAdmin, getUserTokensByAdmin } from '../../api'
import { USER_STATUS } from '../../constants'
import type { User } from '../../types'
import { useUsers } from '../users-provider'
import { AccessCheckPanel } from './access-check-panel'
import { UserLogsPanel, UserTasksPanel } from './user-activity-panel'
import { UserGroupsPanel } from './user-groups-panel'
import { UserTokensPanel } from './user-tokens-panel'

type DetailTab = 'check' | 'tokens' | 'logs' | 'tasks' | 'groups'

function Stat(props: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='truncate font-mono text-sm font-medium tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}

export function UserDetailDrawer(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { setOpen, setCurrentRow } = useUsers()
  const [tab, setTab] = useState<DetailTab>('check')
  const user = props.user
  const userId = user?.id ?? 0

  const tokens = useQuery({
    queryKey: ['user-detail-tokens', userId],
    queryFn: async () =>
      requireServerSuccess(await getUserTokensByAdmin(userId)).data,
    enabled: props.open && userId > 0,
  })
  const groups = useQuery({
    queryKey: ['user-detail-groups', userId],
    queryFn: async () =>
      requireServerSuccess(await getUserGroupsByAdmin(userId)).data,
    enabled: props.open && userId > 0,
  })

  const tokenItems = tokens.data?.items ?? []
  const groupItems = groups.data?.groups ?? []
  const enabled = user?.status === USER_STATUS.ENABLED

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[720px]')}>
        <SheetHeader className={sideDrawerHeaderClassName('gap-3')}>
          <SheetTitle className='flex flex-wrap items-baseline gap-2 pr-8'>
            <span>{user?.display_name || user?.username}</span>
            <span className='text-muted-foreground font-mono text-xs'>
              {user?.username} #{user?.id}
            </span>
          </SheetTitle>
          <SheetDescription render={<div />}>
            <div className='flex flex-wrap items-center gap-1.5'>
              <StatusBadge
                label={enabled ? t('Normal') : t('Banned')}
                variant={enabled ? 'success' : 'neutral'}
                copyable={false}
              />
              <GroupBadge group={user?.group || 'default'} />
              <StatusBadge
                label={t('{{count}} tokens', {
                  count: tokens.data?.total ?? 0,
                })}
                variant='neutral'
                copyable={false}
              />
            </div>
          </SheetDescription>
          {user && (
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <Stat
                label={t('Remaining quota')}
                value={formatQuota(user.quota)}
              />
              <Stat
                label={t('Used Quota')}
                value={formatQuota(user.used_quota)}
              />
              <Stat
                label={t('Requests')}
                value={formatNumber(user.request_count, locale)}
              />
              <Stat
                label={t('Last Login')}
                value={formatTimestampToDate(user.last_login_at)}
              />
            </div>
          )}
          {user && (
            <div className='flex flex-wrap gap-2'>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  setCurrentRow(user)
                  setOpen('update')
                }}
              >
                {t('Edit user')}
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className={sideDrawerFormClassName('gap-4')}>
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as DetailTab)}
          >
            <TabsList
              variant='line'
              className='w-full justify-start overflow-x-auto'
            >
              <TabsTrigger value='check' className='flex-none'>
                {t('Access check')}
              </TabsTrigger>
              <TabsTrigger value='tokens' className='flex-none'>
                {t('Tokens')}
              </TabsTrigger>
              <TabsTrigger value='logs' className='flex-none'>
                {t('Requests')}
              </TabsTrigger>
              <TabsTrigger value='tasks' className='flex-none'>
                {t('Tasks')}
              </TabsTrigger>
              <TabsTrigger value='groups' className='flex-none'>
                {t('Groups and models')}
              </TabsTrigger>
            </TabsList>

            {(tokens.isLoading || groups.isLoading) && (
              <Skeleton className='mt-4 h-40 w-full' />
            )}
            {user && tokens.data && groups.data && (
              <>
                <TabsContent value='check' className='pt-4'>
                  <AccessCheckPanel
                    key={user.id}
                    userId={user.id}
                    username={user.username}
                    tokens={tokenItems}
                    groups={groupItems}
                  />
                </TabsContent>
                <TabsContent value='tokens' className='pt-4'>
                  <UserTokensPanel
                    tokens={tokenItems}
                    total={tokens.data.total}
                  />
                </TabsContent>
                <TabsContent value='logs' className='pt-4'>
                  <UserLogsPanel username={user.username} />
                </TabsContent>
                <TabsContent value='tasks' className='pt-4'>
                  <UserTasksPanel userId={user.id} />
                </TabsContent>
                <TabsContent value='groups' className='pt-4'>
                  <UserGroupsPanel groups={groupItems} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}

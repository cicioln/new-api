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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getLoginSessions,
  revokeLoginSession,
  revokeOtherLoginSessions,
} from '@/features/profile/api'
import { clearAuthenticatedClientState } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import type { LoginSession } from '@/stores/auth-store'

import { LoginSessionDialogs } from './login-session-dialogs'
import { loginMethodLabel, sessionDevice } from './login-session-utils'

const sessionQueryKey = ['profile', 'login-sessions'] as const

/** Recent sign-ins of the account as a table, with sign-out actions. */
export function LoginSessionsCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [revokeTarget, setRevokeTarget] = useState<LoginSession | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)

  const sessionsQuery = useQuery({
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const response = await getLoginSessions()
      if (!response.success) {
        throw createServerError(response, t('Failed to load login sessions'))
      }
      return response.data ?? []
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (sid: string) => {
      const response = await revokeLoginSession(sid)
      if (!response.success) {
        throw createServerError(response, t('Failed to sign out session'))
      }
      return sid
    },
    onSuccess: async (sid) => {
      const revokedCurrent = sessionsQuery.data?.some(
        (session) => session.sid === sid && session.current
      )
      setRevokeTarget(null)
      if (revokedCurrent) {
        clearAuthenticatedClientState(queryClient)
        void navigate({ to: '/sign-in', replace: true })
        return
      }
      toast.success(t('Session signed out'))
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    },
    onError: (error: Error) => handleServerError(error),
  })

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      const response = await revokeOtherLoginSessions()
      if (!response.success) {
        throw createServerError(
          response,
          t('Failed to sign out other sessions')
        )
      }
    },
    onSuccess: async () => {
      setConfirmOthers(false)
      toast.success(t('Other sessions signed out'))
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey })
    },
    onError: (error: Error) => handleServerError(error),
  })

  const sessions = sessionsQuery.data ?? []
  const hasOtherSessions = sessions.some((session) => !session.current)
  const maxTouchPoints =
    typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
  let rows: ReactNode
  if (sessionsQuery.isLoading) {
    rows = (
      <tr>
        <td colSpan={5}>
          <Skeleton className='h-4 w-full' />
        </td>
      </tr>
    )
  } else if (sessionsQuery.isError) {
    rows = (
      <tr>
        <td colSpan={5} className='py-10 text-center'>
          <p className='text-sm font-medium'>
            {t('Unable to load login sessions')}
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='mt-3'
            onClick={() => sessionsQuery.refetch()}
          >
            {t('Retry')}
          </Button>
        </td>
      </tr>
    )
  } else if (sessions.length === 0) {
    rows = (
      <tr>
        <td
          colSpan={5}
          className='text-muted-foreground py-10 text-center text-sm'
        >
          {t('No active login sessions')}
        </td>
      </tr>
    )
  } else {
    rows = sessions.map((session) => (
      <tr key={session.sid} className='hover:bg-muted/50 transition-colors'>
        <td className='text-muted-foreground font-mono text-xs'>
          {dayjs.unix(session.created_at).format('MM-DD HH:mm')}
        </td>
        <td>{loginMethodLabel(session.login_method, t)}</td>
        <td className='font-mono text-xs'>{session.ip || t('Unknown')}</td>
        <td>
          {sessionDevice(
            session.user_agent,
            t('Unknown device'),
            t('Browser'),
            session.current ? maxTouchPoints : 0
          )}
          {session.current && (
            <span className='text-muted-foreground ml-1.5 text-xs'>
              · {t('Current')}
            </span>
          )}
        </td>
        <td className='text-right'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setRevokeTarget(session)}
          >
            {session.current ? t('Sign out') : t('Revoke')}
          </Button>
        </td>
      </tr>
    ))
  }

  return (
    <>
      <section
        aria-labelledby='security-recent-logins'
        className='bg-card overflow-hidden rounded-lg border'
      >
        <div className='flex items-center justify-between gap-3 px-[18px] pt-4 pb-3'>
          <h3 id='security-recent-logins' className='text-sm font-semibold'>
            {t('Recent logins')}
          </h3>
          <Button
            type='button'
            variant='link'
            size='sm'
            className='text-muted-foreground h-auto p-0 text-xs'
            disabled={!hasOtherSessions || revokeOthersMutation.isPending}
            onClick={() => setConfirmOthers(true)}
          >
            {t('Sign out other sessions')}
          </Button>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse text-[13px]'>
            <thead>
              <tr className='bg-background text-muted-foreground border-y text-left text-xs [&>th]:px-[18px] [&>th]:py-2.5 [&>th]:font-medium [&>th]:whitespace-nowrap'>
                <th>{t('Time')}</th>
                <th>{t('Login method')}</th>
                <th>{t('IP')}</th>
                <th>{t('Device')}</th>
                <th>
                  <span className='sr-only'>{t('Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className='[&_td]:px-[18px] [&_td]:py-[11px] [&_td]:whitespace-nowrap [&>tr]:border-b [&>tr:last-child]:border-0'>
              {rows}
            </tbody>
          </table>
        </div>
      </section>

      <LoginSessionDialogs
        revokeTarget={revokeTarget}
        confirmOthers={confirmOthers}
        revoking={revokeMutation.isPending}
        revokingOthers={revokeOthersMutation.isPending}
        onRevokeTargetChange={setRevokeTarget}
        onConfirmOthersChange={setConfirmOthers}
        onRevoke={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.sid)
        }}
        onRevokeOthers={() => revokeOthersMutation.mutate()}
      />
    </>
  )
}

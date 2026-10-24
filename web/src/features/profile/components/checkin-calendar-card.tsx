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
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getCheckinStatus, performCheckin } from '../api'
import type { CheckinRecord } from '../types'

interface CheckinCalendarCardProps {
  checkinEnabled: boolean
  turnstileEnabled: boolean
  turnstileSiteKey: string
}

export function CheckinCalendarCard(props: CheckinCalendarCardProps) {
  const checkinEnabled = props.checkinEnabled
  const turnstileEnabled = props.turnstileEnabled
  const turnstileSiteKey = props.turnstileSiteKey
  const { t, i18n } = useTranslation()
  // The design shows the current month only.
  const [currentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)

  const currentMonthStr = useMemo(() => {
    const y = currentMonth.getFullYear()
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [currentMonth])

  // Fetch checkin status
  /* eslint-disable @tanstack/query/exhaustive-deps */
  const {
    data: checkinData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['checkin-status', currentMonthStr],
    queryFn: async () => {
      const res = await getCheckinStatus(currentMonthStr)
      if (res.success && res.data) {
        return res.data
      }
      throw createServerError(res, t('Failed to fetch checkin status'))
    },
    enabled: checkinEnabled,
    staleTime: 30000,
  })
  /* eslint-enable @tanstack/query/exhaustive-deps */

  const checkinRecordsMap = useMemo(() => {
    const map: Record<string, number> = {}
    const records = checkinData?.stats?.records || []
    records.forEach((record: CheckinRecord) => {
      map[record.checkin_date] = record.quota_awarded
    })
    return map
  }, [checkinData?.stats?.records])

  const todayString = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const checkedToday = checkinData?.stats?.checked_in_today === true
  const todayAward = checkinRecordsMap[todayString]

  const shouldTriggerTurnstile = useCallback(
    (message?: string) => {
      if (!turnstileEnabled) return false
      if (typeof message !== 'string') return true
      return message.includes('Turnstile')
    },
    [turnstileEnabled]
  )

  const doCheckin = useCallback(
    async (token?: string) => {
      setCheckinLoading(true)
      try {
        const res = await performCheckin(token)
        if (res.success && res.data) {
          toast.success(
            `${t('Check-in successful! Received')} ${formatQuotaWithCurrency(res.data.quota_awarded)}`
          )
          refetch()
          setTurnstileModalVisible(false)
        } else {
          if (!token && shouldTriggerTurnstile(res.message)) {
            if (!turnstileSiteKey) {
              toast.error(t('Turnstile is enabled but site key is empty.'))
              return
            }
            setTurnstileModalVisible(true)
            return
          }
          if (token && shouldTriggerTurnstile(res.message)) {
            setTurnstileWidgetKey((v) => v + 1)
          }
          handleServerError(res, t('Check-in failed'))
        }
      } catch (error) {
        handleServerError(error, t('Check-in failed'))
      } finally {
        setCheckinLoading(false)
      }
    },
    [refetch, shouldTriggerTurnstile, t, turnstileSiteKey]
  )

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    // Weeks start on Monday: Sunday (0) moves to the last column.
    const startDayOfWeek = (firstDay.getDay() + 6) % 7

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

    // Fill leading empty days
    for (let i = 0; i < startDayOfWeek; i++) {
      const d = new Date(year, month, -startDayOfWeek + i + 1)
      days.push({ date: d, isCurrentMonth: false })
    }

    // Fill current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Fill trailing empty days to complete the grid
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
      }
    }

    return days
  }, [currentMonth])

  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  // 2023-01-02 is a Monday; the grid starts on Monday.
  const weekDays = Array.from({ length: 7 }, (_, index) => ({
    id: `weekday-${index}`,
    label: weekdayFormat.format(new Date(2023, 0, 2 + index)),
  }))

  if (!checkinEnabled) {
    return null
  }

  if (isLoading) {
    return (
      <section className='bg-card rounded-lg border p-[18px]'>
        <div>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <Skeleton className='h-10 w-10 rounded-xl' />
              <div className='space-y-2'>
                <Skeleton className='h-5 w-32' />
                <Skeleton className='h-3 w-56' />
              </div>
            </div>
            <Skeleton className='h-9 w-28 rounded-md' />
          </div>
        </div>
      </section>
    )
  }

  let checkinButtonLabel = t('Check in now')
  if (checkinLoading) {
    checkinButtonLabel = t('Loading...')
  } else if (checkedToday) {
    checkinButtonLabel = t('Checked in today')
  }

  const monthCheckins = checkinData?.stats?.records?.length ?? 0

  return (
    <TooltipProvider delay={100}>
      <Dialog
        open={turnstileModalVisible}
        onOpenChange={(open) => {
          setTurnstileModalVisible(open)
          if (!open) {
            setTurnstileWidgetKey((v) => v + 1)
          }
        }}
        title={t('Security Check')}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        bodyClassName='space-y-4'
      >
        <div className='text-muted-foreground text-sm'>
          {t('Please complete the security check to continue.')}
        </div>
        <div className='flex justify-center py-4'>
          <Turnstile
            key={turnstileWidgetKey}
            siteKey={turnstileSiteKey}
            onVerify={(token) => {
              doCheckin(token)
            }}
            onExpire={() => {
              setTurnstileWidgetKey((v) => v + 1)
            }}
          />
        </div>
      </Dialog>

      <section
        aria-labelledby='profile-checkin'
        className='bg-card min-w-0 rounded-lg border p-[18px]'
      >
        <div className='flex items-center justify-between gap-2'>
          <h3 id='profile-checkin' className='text-sm font-semibold'>
            {t('Daily Check-in')}
          </h3>
          <span className='text-muted-foreground text-xs'>
            {dayjs(currentMonth).format('YYYY-MM')}
          </span>
        </div>
        <p className='text-muted-foreground mt-0.5 text-[12.5px]'>
          {checkedToday && todayAward !== undefined
            ? `${t('Today')} +${formatQuotaWithCurrency(todayAward)}`
            : t(
                'Check in once a day to receive a random quota reward added directly to your balance.'
              )}
        </p>

        <div data-testid='checkin-grid' className='mt-3 grid grid-cols-7 gap-1'>
          {weekDays.map((day) => (
            <span
              key={day.id}
              aria-hidden='true'
              className='text-muted-foreground grid aspect-square place-items-center text-[11px]'
            >
              {day.label}
            </span>
          ))}
          {calendarDays.map((dayObj) => {
            const dateStr = `${dayObj.date.getFullYear()}-${String(
              dayObj.date.getMonth() + 1
            ).padStart(2, '0')}-${String(dayObj.date.getDate()).padStart(
              2,
              '0'
            )}`
            if (!dayObj.isCurrentMonth) {
              return <span key={dateStr} aria-hidden='true' />
            }
            const isToday = dateStr === todayString
            const quotaAwarded = checkinRecordsMap[dateStr]
            const isCheckedIn = quotaAwarded !== undefined
            const dayCell = (
              <span
                key={dateStr}
                data-checked={isCheckedIn || undefined}
                data-today={isToday || undefined}
                className={cn(
                  'bg-muted text-muted-foreground grid aspect-square place-items-center rounded-md font-mono text-[11px] tabular-nums',
                  isCheckedIn && 'bg-primary/10 text-primary font-semibold',
                  isToday &&
                    'ring-foreground text-foreground ring-[1.5px] ring-inset'
                )}
              >
                {dayObj.date.getDate()}
              </span>
            )
            if (!isCheckedIn) return dayCell
            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger render={dayCell} />
                <TooltipContent>
                  {t('Checked in')} +{formatQuotaWithCurrency(quotaAwarded)}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <dl className='mt-3.5 grid grid-cols-3 gap-2'>
          <div className='bg-muted rounded-lg px-2.5 py-2'>
            <dt className='text-muted-foreground text-[11px]'>
              {t('This month')}
            </dt>
            <dd className='font-mono text-sm font-medium tabular-nums'>
              {t('{{count}} days', { count: monthCheckins })}
            </dd>
          </div>
          <div className='bg-muted rounded-lg px-2.5 py-2'>
            <dt className='text-muted-foreground text-[11px]'>
              {t('Total check-ins')}
            </dt>
            <dd className='font-mono text-sm font-medium tabular-nums'>
              {t('{{count}} times', {
                count: checkinData?.stats?.total_checkins || 0,
              })}
            </dd>
          </div>
          <div className='bg-muted rounded-lg px-2.5 py-2'>
            <dt className='text-muted-foreground text-[11px]'>
              {t('Total earned')}
            </dt>
            <dd className='font-mono text-sm font-medium tabular-nums'>
              {formatQuotaWithCurrency(checkinData?.stats?.total_quota || 0)}
            </dd>
          </div>
        </dl>

        <Button
          className='mt-3.5 w-full'
          onClick={() => doCheckin()}
          disabled={checkinLoading || checkedToday}
        >
          {checkinButtonLabel}
        </Button>
      </section>
    </TooltipProvider>
  )
}

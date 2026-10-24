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

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { getNotice } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useNotificationStore } from '@/stores/notification-store'

/**
 * The system notice pops up once per visit to the overview. "Don't show
 * again today" mutes it until the next calendar day.
 */
export function OverviewNoticeDialog() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const closedToday = useNotificationStore((state) => state.isNoticeClosed())
  const setClosedUntilDate = useNotificationStore(
    (state) => state.setClosedUntilDate
  )
  const markNoticeRead = useNotificationStore((state) => state.markNoticeRead)
  // Shares its cache with the header notification center.
  const noticeQuery = useQuery({
    queryKey: ['notice'],
    queryFn: async () => requireServerSuccess(await getNotice()),
    staleTime: 1000 * 60 * 5,
    meta: { errorToast: false },
  })
  const notice = (noticeQuery.data?.data ?? '').trim()

  const close = () => {
    if (notice) markNoticeRead(notice)
    setDismissed(true)
  }

  const muteToday = () => {
    setClosedUntilDate(new Date().toDateString())
    close()
  }

  return (
    <Dialog
      open={Boolean(notice) && !closedToday && !dismissed}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={t('System Notice')}
      contentClassName='gap-0 rounded-[14px] p-0 sm:max-w-[480px] sm:p-0'
      headerClassName='border-b px-5 py-4'
      titleClassName='text-[15px] font-semibold'
      bodyClassName='px-5 py-4 [&_p]:mb-2 [&_p]:text-sm [&_p]:leading-[1.75]'
      footerClassName='m-0 rounded-b-[14px] bg-transparent px-5 py-3 sm:m-0 sm:px-5 sm:py-3'
      footer={
        <>
          <Button variant='outline' size='sm' onClick={muteToday}>
            {t("Don't show again today")}
          </Button>
          <Button size='sm' onClick={close}>
            {t('Got it')}
          </Button>
        </>
      }
    >
      <RichContent breaks content={notice} />
    </Dialog>
  )
}

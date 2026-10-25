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
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { getSystemReleaseUrl } from '@/features/system-update/releases'
import type { useSystemUpdate } from '@/features/system-update/use-system-update'

type SystemUpdateNoticeProps = {
  update: ReturnType<typeof useSystemUpdate>
}

export function SystemUpdateNotice(props: SystemUpdateNoticeProps) {
  const { t } = useTranslation()
  const release = props.update.release
  if (!props.update.shouldNotify || !release) return null

  return (
    <div
      role='status'
      className='bg-warning/10 mb-[18px] flex gap-3 rounded-[10px] p-3.5 text-[13px] leading-[1.6]'
    >
      <HugeiconsIcon
        icon={Alert02Icon}
        className='text-warning mt-px size-[18px] shrink-0'
        aria-hidden='true'
      />
      <div className='min-w-0'>
        <b>
          {t('New version available: {{version}}', {
            version: release.tag_name,
          })}
        </b>
        {props.update.currentVersion && (
          <>
            {' · '}
            {t('Current version: {{version}}', {
              version: props.update.currentVersion,
            })}
          </>
        )}{' '}
        <a
          href={getSystemReleaseUrl(release)}
          target='_blank'
          rel='noreferrer'
          className='underline'
        >
          {t('View changelog')}
        </a>
      </div>
    </div>
  )
}

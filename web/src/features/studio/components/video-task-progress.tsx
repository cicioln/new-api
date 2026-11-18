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
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

/** Stage data is optional: other video providers retain the existing label. */
export function VideoTaskProgress(props: {
  data?: unknown
  inProgress: boolean
  progress: number
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const data =
    props.data && typeof props.data === 'object' && !Array.isArray(props.data)
      ? (props.data as Record<string, unknown>)
      : {}
  let label = props.inProgress ? t('Generating') : t('Queued')
  switch (data.stage) {
    case 'queued':
      label = t('Queued')
      break
    case 'retrying':
      label = t('Waiting to retry')
      break
    case 'planning':
      label = t('Planning video shots')
      break
    case 'connecting':
      label = t('Connecting to video service')
      break
    case 'generating':
      label = t('Generating')
      break
    case 'downloading':
      label = t('Downloading video')
      break
    case 'joining':
      label = t('Assembling video')
      break
    case 'status_unknown':
    case 'recovering':
      label = t('Checking task status')
      break
  }
  const parts = [label]
  if (
    typeof data.segment === 'number' &&
    Number.isInteger(data.segment) &&
    typeof data.segments === 'number' &&
    Number.isInteger(data.segments) &&
    data.segment > 0 &&
    data.segment <= data.segments &&
    data.segments > 1 &&
    data.segments <= 60
  ) {
    parts.push(
      t('Segment {{current}}/{{total}}', {
        current: formatNumber(data.segment, locale),
        total: formatNumber(data.segments, locale),
      })
    )
  }
  if (
    typeof data.attempt === 'number' &&
    Number.isInteger(data.attempt) &&
    data.attempt > 1
  ) {
    parts.push(t('Attempt {{count}}', { count: data.attempt }))
  }
  if (
    props.inProgress &&
    Number.isFinite(props.progress) &&
    props.progress > 0
  ) {
    parts.push(`${formatNumber(Math.min(props.progress, 99), locale)}%`)
  }
  return <>{parts.join(' · ')}</>
}

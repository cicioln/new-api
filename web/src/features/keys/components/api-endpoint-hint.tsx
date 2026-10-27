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

import { CopyButton } from '@/components/copy-button'

/** The API base URL, shown above the key list so it can be copied in one click. */
export function ApiEndpointHint() {
  const { t } = useTranslation()
  // The configured server address defaults to localhost and is often left
  // unset, so use the domain the user is actually browsing.
  const endpoint = window.location.origin

  return (
    <div className='mb-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border bg-[linear-gradient(90deg,color-mix(in_srgb,var(--primary)_14%,var(--card)),var(--card)_60%)] px-[18px] py-4'>
      <div className='min-w-0'>
        <b className='text-sm'>{t('API endpoint')}</b>
        <p className='text-muted-foreground mt-0.5 truncate font-mono text-[13px]'>
          {endpoint} · {t('Compatible with OpenAI / Claude / Gemini SDKs')}
        </p>
      </div>
      <CopyButton
        value={endpoint}
        variant='outline'
        size='sm'
        hideIcon
        tooltip={t('Copy API URL')}
        aria-label={`${t('Copy API URL')}: ${endpoint}`}
      >
        {t('Copy address')}
      </CopyButton>
    </div>
  )
}

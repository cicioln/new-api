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

/**
 * Compact API base URL chip for the page header, copyable in one click.
 */
export function ApiEndpointHint() {
  const { t } = useTranslation()
  // The configured server address defaults to localhost and is often left
  // unset, so use the domain the user is actually browsing.
  const endpoint = window.location.origin

  return (
    <div
      title={t('Compatible with OpenAI / Claude / Gemini SDKs')}
      className='bg-card inline-flex h-[30px] max-w-full min-w-0 items-center gap-2 rounded-[7px] border pr-0.5 pl-2.5 text-[13px]'
    >
      <span className='text-subtle-foreground shrink-0'>
        {t('API endpoint')}
      </span>
      <span aria-hidden className='bg-border h-3.5 w-px shrink-0' />
      <code className='min-w-0 truncate font-mono text-[12.5px]'>
        {endpoint}
      </code>
      <CopyButton
        value={endpoint}
        className='size-6'
        iconClassName='size-3.5'
        tooltip={t('Copy API URL')}
        aria-label={`${t('Copy API URL')}: ${endpoint}`}
      />
    </div>
  )
}

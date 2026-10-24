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
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { downloadCsv, toCsvLine } from '@/features/usage-logs/lib/export'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { getApiKeys } from '../api'
import { API_KEY_STATUSES, ERROR_MESSAGES } from '../constants'
import type { ApiKey } from '../types'
import { useApiKeys } from './api-keys-provider'

const EXPORT_PAGE_SIZE = 100

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const keys: ApiKey[] = []
      for (let page = 1; ; page++) {
        const result = await getApiKeys({ p: page, size: EXPORT_PAGE_SIZE })
        if (!result.success) {
          throw createServerError(result, t(ERROR_MESSAGES.LOAD_FAILED))
        }
        const items = result.data?.items ?? []
        keys.push(...items)
        if (items.length < EXPORT_PAGE_SIZE) break
        if (keys.length >= (result.data?.total ?? 0)) break
      }
      const header = [
        t('Name'),
        t('API Key'),
        t('Status'),
        t('Group'),
        t('Used amount'),
        t('Remaining'),
        t('Models'),
        t('Expiration Time'),
        t('Last Used'),
      ]
      const rows = keys.map((key) => {
        const status = API_KEY_STATUSES[key.status]
        return [
          key.name,
          `sk-${key.key}`,
          status ? t(status.label) : String(key.status),
          key.group || '',
          formatQuotaWithCurrency(key.used_quota),
          key.unlimited_quota
            ? t('Unlimited quota')
            : formatQuotaWithCurrency(key.remain_quota),
          key.model_limits_enabled ? key.model_limits || '' : t('All'),
          key.expired_time === -1
            ? t('Never expires')
            : formatTimestampToDate(key.expired_time),
          formatTimestampToDate(key.accessed_time),
        ]
      })
      downloadCsv(
        'api-keys.csv',
        [header, ...rows].map((cells) => toCsvLine(cells))
      )
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting && <Loader2 className='animate-spin' aria-hidden='true' />}
        {t('Export')}
      </Button>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus aria-hidden='true' />
        {t('New key')}
      </Button>
    </div>
  )
}

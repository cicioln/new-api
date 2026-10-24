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
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import { searchRedemptions } from '../api'
import { ERROR_MESSAGES, REDEMPTION_STATUS } from '../constants'
import type { Redemption } from '../types'
import { useRedemptions } from './redemptions-provider'

const EXPORT_PAGE_SIZE = 100

async function fetchUnusedRedemptions(): Promise<Redemption[]> {
  const items: Redemption[] = []
  for (let page = 1; ; page++) {
    const result = await searchRedemptions({
      status: String(REDEMPTION_STATUS.ENABLED),
      p: page,
      page_size: EXPORT_PAGE_SIZE,
    })
    if (!result.success) throw result
    const pageItems = result.data?.items ?? []
    items.push(...pageItems)
    if (
      pageItems.length < EXPORT_PAGE_SIZE ||
      items.length >= (result.data?.total ?? 0)
    ) {
      return items
    }
  }
}

function downloadRedemptions(items: Redemption[]) {
  const content = `${items
    .map((item) =>
      [item.name, item.key, formatQuota(item.quota)]
        .map((value) => value.replaceAll(/[\t\r\n]+/g, ' '))
        .join('\t')
    )
    .join('\n')}\n`
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `redemption-codes-unused-${Date.now()}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function RedemptionsPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useRedemptions()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const items = await fetchUnusedRedemptions()
      if (items.length === 0) {
        toast.info(t('No unused codes to export'))
        return
      }
      downloadRedemptions(items)
      toast.success(t('Exported {{count}} codes', { count: items.length }))
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.LOAD_FAILED))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        size='sm'
        variant='outline'
        onClick={handleExport}
        disabled={isExporting}
      >
        {t('Export unused')}
      </Button>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus aria-hidden='true' />
        {t('Batch generate')}
      </Button>
    </div>
  )
}

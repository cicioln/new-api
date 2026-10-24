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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import dayjs from '@/lib/dayjs'

import { downloadCsv, toCsvLine } from '../../lib/export'
import { getAuditLogs, type AuditFilters } from '../api'
import { auditRowText } from '../lib/audit-row'

// Page size the audit API accepts at most, and a bound on one export.
const EXPORT_PAGE_SIZE = 100
const EXPORT_MAX_PAGES = 100

/** Header "Export" button: saves the records matching the current filters. */
export function AuditExportButton(props: {
  scope: 'all' | 'self'
  params?: AuditFilters
}) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const lines = [
        toCsvLine([
          t('Time'),
          t('Operator'),
          t('Action'),
          t('Object'),
          'IP',
          t('Client'),
          t('Result'),
          t('Request ID'),
        ]),
      ]
      for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
        const data = await getAuditLogs(props.scope, {
          ...props.params,
          p: page,
          page_size: EXPORT_PAGE_SIZE,
        })
        for (const entry of data.items) {
          const text = auditRowText(entry, t)
          lines.push(
            toCsvLine([
              dayjs.unix(entry.created_at).format('YYYY-MM-DD HH:mm:ss'),
              entry.username ?? '',
              [text.action, text.identifier].filter(Boolean).join(' '),
              text.object,
              entry.ip ?? '',
              text.client,
              entry.success ? t('Success') : t('Blocked'),
              entry.request_id ?? '',
            ])
          )
        }
        if (page * EXPORT_PAGE_SIZE >= data.total) break
      }
      downloadCsv(`audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`, lines)
      toast.success(t('Exported {{count}} logs', { count: lines.length - 1 }))
    } catch {
      toast.error(t('Export failed'))
    } finally {
      setExporting(false)
    }
  }
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      disabled={!props.params || exporting}
      onClick={() => void handleExport()}
    >
      {t('Export')}
    </Button>
  )
}

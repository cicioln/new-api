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
import type { Row } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useCanEditModelPricing } from '@/features/model-pricing/api'

import type { Model } from '../types'
import { ModelDeleteDialog } from './dialogs/model-delete-dialog'
import { useModels } from './models-provider'

interface DataTableRowActionsProps {
  row: Row<Model>
}

export function DataTableRowActions(props: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const canPrice = useCanEditModelPricing()
  const model = props.row.original
  const { setOpen, setCurrentRow } = useModels()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  return (
    <>
      <DataTableRowActionMenu ariaLabel={t('Open menu')}>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(model)
            setOpen('update-model')
          }}
        >
          {model.id > 0 ? t('Edit') : t('Add metadata')}
        </DropdownMenuItem>
        {canPrice && (
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(model)
              setOpen('price-model')
            }}
          >
            {t('Pricing')}
          </DropdownMenuItem>
        )}
        {model.id > 0 && (
          <DropdownMenuItem
            variant='destructive'
            onClick={() => setDeleteConfirmOpen(true)}
          >
            {t('Delete')}
          </DropdownMenuItem>
        )}
      </DataTableRowActionMenu>

      {deleteConfirmOpen && (
        <ModelDeleteDialog
          models={[model]}
          onClose={() => setDeleteConfirmOpen(false)}
        />
      )}
    </>
  )
}

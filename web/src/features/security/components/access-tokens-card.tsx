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

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/auth-store'

import { listAccessTokens } from '../api'
import { AccessTokensPanel } from './access-tokens-panel'
import { SecurityRow } from './security-row'

/** System access token row; management opens in a side sheet. */
export function AccessTokensCard() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const [open, setOpen] = useState(false)
  const list = useQuery({
    queryKey: ['security', 'access-tokens', 'list', userId],
    queryFn: listAccessTokens,
    retry: false,
  })
  const hint = list.data?.items[0]?.token_hint ?? list.data?.legacy?.token_hint

  return (
    <SecurityRow
      title={t('System access token')}
      description={t(
        'Used to call the management API (/api/*), not a model API key'
      )}
      actions={
        <>
          {hint && (
            <span className='bg-muted inline-flex items-center rounded-md px-2 py-[3px] font-mono text-[12.5px]'>
              ••••••••{hint}
            </span>
          )}
          <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
            {t('Manage')}
          </Button>
        </>
      }
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className='w-full sm:max-w-3xl' showCloseButton={false}>
          <SheetHeader className='border-b pr-20'>
            <SheetTitle>{t('Access tokens')}</SheetTitle>
          </SheetHeader>
          <SheetClose
            render={
              <Button
                size='sm'
                variant='ghost'
                className='absolute top-3 right-3'
              />
            }
          >
            {t('Close')}
          </SheetClose>
          <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4'>
            {open && <AccessTokensPanel />}
          </div>
        </SheetContent>
      </Sheet>
    </SecurityRow>
  )
}

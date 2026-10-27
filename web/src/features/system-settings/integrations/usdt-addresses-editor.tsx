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
import { Plus, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type UsdtAddressEntry = { name: string; address: string }

export function parseUsdtAddresses(value: string): UsdtAddressEntry[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({
      name: String(item?.name ?? ''),
      address: String(item?.address ?? ''),
    }))
  } catch {
    return []
  }
}

/**
 * Edits the USDT receiving addresses as name + address rows. The value is the
 * JSON array stored in payment_setting.usdt_addresses.
 */
export function UsdtAddressesEditor(props: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const entries = useMemo(() => parseUsdtAddresses(props.value), [props.value])

  const update = (next: UsdtAddressEntry[]) =>
    props.onChange(JSON.stringify(next))

  return (
    <div className='grid gap-2'>
      {entries.map((entry, index) => (
        <div key={index} className='flex items-center gap-2'>
          <Input
            className='w-40 shrink-0'
            aria-label={t('Network name')}
            placeholder={t('e.g. BSC (BEP20)')}
            value={entry.name}
            onChange={(event) =>
              update(
                entries.map((item, i) =>
                  i === index ? { ...item, name: event.target.value } : item
                )
              )
            }
          />
          <Input
            className='min-w-0 flex-1 font-mono'
            aria-label={t('Receiving address')}
            placeholder='0x... / T...'
            autoComplete='off'
            value={entry.address}
            onChange={(event) =>
              update(
                entries.map((item, i) =>
                  i === index ? { ...item, address: event.target.value } : item
                )
              )
            }
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label={t('Remove')}
            onClick={() => update(entries.filter((_, i) => i !== index))}
          >
            <X className='size-4' aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        className='justify-self-start'
        onClick={() => update([...entries, { name: '', address: '' }])}
      >
        <Plus className='size-4' aria-hidden />
        {t('Add address')}
      </Button>
    </div>
  )
}

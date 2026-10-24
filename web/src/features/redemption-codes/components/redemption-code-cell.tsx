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
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/copy-to-clipboard'

import { maskRedemptionCode } from '../lib'

export function RedemptionCodeCell(props: { code: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!(await copyToClipboard(props.code))) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className='bg-muted inline-flex items-center gap-2 rounded-md px-2 py-[3px] font-mono! text-[12.5px]! whitespace-nowrap'>
      {maskRedemptionCode(props.code)}
      <Button
        variant='ghost'
        size='icon-xs'
        aria-label={t(copied ? 'Copied!' : 'Copy redemption code')}
        onClick={handleCopy}
        className='text-subtle-foreground hover:text-foreground size-auto shrink-0 p-0 hover:bg-transparent'
      >
        {copied ? (
          <Check className='text-success size-[13px]' aria-hidden='true' />
        ) : (
          <Copy className='size-[13px]' aria-hidden='true' />
        )}
      </Button>
    </span>
  )
}

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
import { Trans, useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  checked: boolean
  onCheckedChange: (nextValue: boolean) => void
  className?: string
}

export function LegalConsent(props: LegalConsentProps) {
  const { t } = useTranslation()
  const hasUserAgreement = Boolean(props.status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(props.status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const linkClassName =
    'text-foreground underline underline-offset-[3px] hover:opacity-75'
  const links = {
    terms: (
      <a
        href='/user-agreement'
        target='_blank'
        rel='noopener noreferrer'
        className={linkClassName}
      />
    ),
    privacy: (
      <a
        href='/privacy-policy'
        target='_blank'
        rel='noopener noreferrer'
        className={linkClassName}
      />
    ),
  }
  let consentKey =
    'I have read and agree to the <terms>User Agreement</terms> and <privacy>Privacy Policy</privacy>'
  if (!hasPrivacyPolicy) {
    consentKey = 'I have read and agree to the <terms>User Agreement</terms>'
  } else if (!hasUserAgreement) {
    consentKey =
      'I have read and agree to the <privacy>Privacy Policy</privacy>'
  }

  return (
    <div
      className={cn(
        'text-subtle-foreground flex items-center gap-2 text-[12.5px]',
        props.className
      )}
    >
      <Checkbox
        id='legal-consent'
        checked={props.checked}
        onCheckedChange={(value) => props.onCheckedChange(value === true)}
      />
      <Label
        htmlFor='legal-consent'
        className='text-subtle-foreground text-[12.5px] leading-[1.55] font-normal'
      >
        <span>
          <Trans t={t} i18nKey={consentKey} components={links} />
        </span>
      </Label>
    </div>
  )
}

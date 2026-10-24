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

import type { SetupFormValues, SetupStatus } from '../types'

interface CompleteStepProps {
  status?: SetupStatus
  values: SetupFormValues
}

const USAGE_MODE_LABEL_KEYS: Record<SetupFormValues['usageMode'], string> = {
  external: 'External operations mode',
  self: 'Personal use mode',
  demo: 'Demo site mode',
}

export function CompleteStep(props: CompleteStepProps) {
  const { t } = useTranslation()

  return (
    <section>
      <h2 className='text-base font-semibold'>{t('Ready to initialize')}</h2>
      <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t(
          'Double check the configuration below. Your system will be locked until initialization is complete.'
        )}
      </p>
      <dl className='grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-[13px]'>
        <dt className='text-muted-foreground'>{t('Database')}</dt>
        <dd className='font-mono text-[12.5px]'>
          {props.status?.database_type || t('Unknown')}
        </dd>
        <dt className='text-muted-foreground'>{t('Administrator account')}</dt>
        <dd className='font-mono text-[12.5px]'>
          {props.status?.root_init
            ? t('Existing account will be reused')
            : props.values.username || t('Not set yet')}
        </dd>
        <dt className='text-muted-foreground'>{t('Usage mode')}</dt>
        <dd className='font-mono text-[12.5px]'>
          {t(USAGE_MODE_LABEL_KEYS[props.values.usageMode])}
        </dd>
      </dl>
    </section>
  )
}

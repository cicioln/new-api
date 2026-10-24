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
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

import type { SetupFormValues, SetupUsageMode } from '../types'

interface UsageModeStepProps {
  form: UseFormReturn<SetupFormValues>
}

const USAGE_MODE_OPTIONS: Array<{
  value: SetupUsageMode
  titleKey: string
  descriptionKey: string
}> = [
  {
    value: 'external',
    titleKey: 'External operations',
    descriptionKey:
      'Serve multiple users or teams with billing and quota control.',
  },
  {
    value: 'self',
    titleKey: 'Personal use',
    descriptionKey:
      'Best for single-tenant deployments. Pricing and billing options stay hidden.',
  },
  {
    value: 'demo',
    titleKey: 'Demo site',
    descriptionKey:
      'Showcase core capabilities with demo credentials and limited access.',
  },
]

export function UsageModeStep(props: UsageModeStepProps) {
  const { t } = useTranslation()

  return (
    <FormField
      control={props.form.control}
      name='usageMode'
      render={({ field }) => (
        <FormItem className='gap-0'>
          <FormLabel className='text-base font-semibold'>
            {t('How will you use the platform?')}
          </FormLabel>
          <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
            {t('You can change this later in system settings.')}
          </p>
          <FormControl>
            <RadioGroup
              value={field.value}
              onValueChange={(value) => {
                props.form.clearErrors('usageMode')
                field.onChange(value as SetupUsageMode)
              }}
              className='grid gap-2'
            >
              {USAGE_MODE_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`usage-mode-${option.value}`}
                  className='bg-card has-data-[checked]:border-foreground has-data-[checked]:ring-muted flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3 font-normal transition-colors has-data-[checked]:ring-3'
                >
                  <RadioGroupItem
                    id={`usage-mode-${option.value}`}
                    value={option.value}
                    className='mt-0.5'
                  />
                  <span>
                    <span className='block text-sm font-medium'>
                      {t(option.titleKey)}
                    </span>
                    <span className='text-muted-foreground text-[12.5px]'>
                      {t(option.descriptionKey)}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

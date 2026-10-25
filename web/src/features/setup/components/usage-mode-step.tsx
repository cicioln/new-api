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
    descriptionKey: 'Serve users with top-up, billing and registration enabled',
  },
  {
    value: 'self',
    titleKey: 'Self use',
    descriptionKey:
      'For yourself or your team only; billing off, no quota limits',
  },
  {
    value: 'demo',
    titleKey: 'Demo instance',
    descriptionKey:
      'Showcase features with a demo account; write operations restricted',
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
          <FormLabel className='text-lg font-semibold'>
            {t('How do you plan to use it?')}
          </FormLabel>
          <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
            {t('You can change this later in System settings › Operations.')}
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
                  className='bg-card has-data-[checked]:border-foreground has-data-[checked]:ring-muted relative block cursor-pointer rounded-[10px] border px-3.5 py-3 font-normal transition-colors has-focus-visible:ring-3 has-data-[checked]:ring-3'
                >
                  <RadioGroupItem
                    id={`usage-mode-${option.value}`}
                    value={option.value}
                    className='sr-only absolute!'
                  />
                  <span>
                    <span className='block text-sm leading-normal font-semibold'>
                      {t(option.titleKey)}
                    </span>
                    <span className='text-muted-foreground block text-[12.5px] leading-normal'>
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

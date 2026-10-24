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
import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Monitor, MoonStar, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { THEME_PRESETS, type ThemePreset } from '@/lib/theme-customization'
import { cn } from '@/lib/utils'

type ThemeMode = 'light' | 'dark' | 'system'

const MODE_OPTIONS: {
  value: ThemeMode
  label: string
  icon: typeof Sun
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: MoonStar },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * Appearance popover: theme mode plus one of six accent presets. Radius,
 * density, font and layout are intentionally not user-configurable.
 */
export function ConfigDrawer() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { customization, setPreset } = useThemeCustomization()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size='icon'
            variant='ghost'
            className='bg-card hover:bg-muted [&_svg]:text-muted-foreground relative size-[34px] rounded-lg border'
            aria-label={t('Open theme settings')}
          />
        }
      >
        <Sun className='size-4' aria-hidden='true' />
      </PopoverTrigger>
      <PopoverContent align='end' className='w-72 gap-3 p-3'>
        <PopoverHeader>
          <PopoverTitle>{t('Appearance')}</PopoverTitle>
        </PopoverHeader>
        <div className='flex flex-col gap-1.5'>
          <span className='text-subtle-foreground text-xs'>{t('Mode')}</span>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as ThemeMode)}
            aria-label={t('Select theme preference')}
            className='bg-muted grid grid-cols-3 gap-0.5 rounded-lg p-0.5'
          >
            {MODE_OPTIONS.map((option) => (
              <RadioPrimitive.Root
                key={option.value}
                value={option.value}
                className={cn(
                  'text-muted-foreground flex h-7 items-center justify-center gap-1.5 rounded-md text-xs outline-none',
                  'focus-visible:ring-ring/50 focus-visible:ring-2',
                  'data-checked:bg-card data-checked:text-foreground data-checked:shadow-xs'
                )}
              >
                <option.icon className='size-3.5' aria-hidden='true' />
                {t(option.label)}
              </RadioPrimitive.Root>
            ))}
          </RadioGroup>
        </div>
        <div className='flex flex-col gap-1.5'>
          <span className='text-subtle-foreground text-xs'>
            {t('Color preset')}
          </span>
          <RadioGroup
            value={customization.preset}
            onValueChange={(value) => setPreset(value as ThemePreset)}
            aria-label={t('Select color preset')}
            className='grid grid-cols-3 gap-1.5'
          >
            {THEME_PRESETS.map((preset) => (
              <RadioPrimitive.Root
                key={preset.value}
                value={preset.value}
                className={cn(
                  'border-border flex h-8 items-center gap-2 rounded-md border px-2 text-xs outline-none',
                  'hover:border-subtle-foreground focus-visible:ring-ring/50 focus-visible:ring-2',
                  'data-checked:border-foreground data-checked:font-medium'
                )}
              >
                <span
                  aria-hidden='true'
                  className='size-3.5 shrink-0 rounded-sm'
                  style={{ background: preset.swatch }}
                />
                <span className='truncate'>{t(`preset.${preset.value}`)}</span>
              </RadioPrimitive.Root>
            ))}
          </RadioGroup>
        </div>
      </PopoverContent>
    </Popover>
  )
}

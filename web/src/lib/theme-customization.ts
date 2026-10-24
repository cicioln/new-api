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
/**
 * Theme customization constants and types.
 *
 * Lives in `lib/` (not `context/`) so it can be imported alongside the
 * provider without breaking React Fast Refresh boundaries.
 *
 * Presets only swap the accent color; canvas, ink and surfaces stay on the
 * shared palette in `styles/theme.css`.
 */

export const THEME_PRESETS = [
  { value: 'default', name: 'Default', swatch: '#ff5a1f' },
  { value: 'anthropic', name: 'Anthropic', swatch: '#d97757' },
  { value: 'ocean', name: 'Ocean', swatch: 'oklch(0.5461 0.2152 262.88)' },
  { value: 'rose', name: 'Rose', swatch: 'oklch(0.5827 0.2418 12.23)' },
  { value: 'forest', name: 'Forest', swatch: 'oklch(0.5276 0.1072 182.22)' },
  {
    value: 'lavender',
    name: 'Lavender',
    swatch: 'oklch(0.5709 0.1808 306.89)',
  },
] as const

export type ThemePreset = (typeof THEME_PRESETS)[number]['value']

export type ThemeCustomization = {
  preset: ThemePreset
}

export const DEFAULT_THEME_CUSTOMIZATION: ThemeCustomization = {
  preset: 'default',
}

export const THEME_PRESET_VALUES = new Set(
  THEME_PRESETS.map((p) => p.value)
) as ReadonlySet<ThemePreset>

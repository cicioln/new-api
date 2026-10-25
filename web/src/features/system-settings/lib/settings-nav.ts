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
import type { TFunction } from 'i18next'

import { getAuthSectionNavItems } from '../auth/section-registry.tsx'
import { getBillingSectionNavItems } from '../billing/section-registry.tsx'
import { getContentSectionNavItems } from '../content/section-registry.tsx'
import { getModelsSectionNavItems } from '../models/section-registry.tsx'
import { getOperationsSectionNavItems } from '../operations/section-registry.tsx'
import { getPolicySectionNavItems } from '../request-policies/section-registry'
import { getSecuritySectionNavItems } from '../security/section-registry.tsx'
import { getSiteSectionNavItems } from '../site/section-registry.tsx'

export type SettingsNavGroup = {
  title: string
  items: { title: string; url: string }[]
}

/**
 * Grouped in-page navigation for `/system-settings/*`, in the order the
 * settings page lists its categories.
 */
export function getSystemSettingsNavGroups(t: TFunction): SettingsNavGroup[] {
  return [
    { title: t('Site'), items: getSiteSectionNavItems(t) },
    { title: t('Auth'), items: getAuthSectionNavItems(t) },
    { title: t('Billing'), items: getBillingSectionNavItems(t) },
    { title: t('Content'), items: getContentSectionNavItems(t) },
    { title: t('Models'), items: getModelsSectionNavItems(t) },
    { title: t('Operations'), items: getOperationsSectionNavItems(t) },
    { title: t('Request policies'), items: getPolicySectionNavItems(t) },
    { title: t('Security'), items: getSecuritySectionNavItems(t) },
  ]
}

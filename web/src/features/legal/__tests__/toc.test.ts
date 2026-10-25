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
import { describe, expect, it } from 'vitest'

import { getNumberedHeadings } from '../toc'

describe('getNumberedHeadings', () => {
  it('returns numbered level-two headings in order', () => {
    const doc =
      '## 1. Scope\n\nText\n\n### 1.1 Detail\n\n## 2、Keys ##\n\n## 3) Billing'
    expect(getNumberedHeadings(doc)).toEqual([
      '1. Scope',
      '2、Keys',
      '3) Billing',
    ])
  })

  it('returns nothing for plain headings', () => {
    expect(getNumberedHeadings('## What we collect\n\n## Contact')).toEqual([])
  })
})

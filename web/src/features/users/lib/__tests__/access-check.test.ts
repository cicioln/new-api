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

import { describeAccessCheckStep } from '../access-check'

// Interpolates like i18next so the assertions read as the English source.
const t = (key: string, params?: Record<string, unknown>) =>
  key.replaceAll(/{{(\w+)}}/g, (_, name: string) =>
    String(params?.[name] ?? '')
  )

describe('describeAccessCheckStep', () => {
  it('names the inherited user group when the token sets none', () => {
    const text = describeAccessCheckStep(
      {
        key: 'effective_group',
        result: 'info',
        detail: {
          effective_group: 'default',
          token_group: '',
          user_group: 'default',
          simulated: false,
        },
      },
      t
    )
    expect(text.title).toBe('Requests run under group default')
    expect(text.detail).toBe(
      'The token sets no group, so it uses the user group.'
    )
  })

  it('marks a simulated group as a what-if', () => {
    const text = describeAccessCheckStep(
      {
        key: 'effective_group',
        result: 'info',
        detail: {
          effective_group: 'Muse',
          token_group: 'Muse',
          user_group: 'default',
          simulated: true,
        },
      },
      t
    )
    expect(text.detail).toBe('Simulated: the token group is set to Muse.')
  })

  it('explains a missing channel with the 503 the gateway returns', () => {
    const text = describeAccessCheckStep(
      { key: 'channels', result: 'fail', detail: { groups: ['default'] } },
      t
    )
    expect(text.title).toBe('No enabled channel serves this model in default')
    expect(text.detail).toBe('The gateway rejects the request with 503.')
  })

  it('falls back to the step key for an unknown step', () => {
    expect(
      describeAccessCheckStep({ key: 'future_step', result: 'info' }, t).title
    ).toBe('future_step')
  })
})

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
import { describe, expect, test } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import type { Message } from '../../../types'
import { buildChatCompletionPayload } from '../payload-builder'

const messages: Message[] = [
  { key: 'u1', from: 'user', versions: [{ id: 'v1', content: 'hi' }] },
]

describe('buildChatCompletionPayload system prompt', () => {
  test('given a system prompt, it is sent as the first message', () => {
    const payload = buildChatCompletionPayload(
      messages,
      { ...DEFAULT_CONFIG, system_prompt: '  Be brief.  ' },
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'hi' },
    ])
  })

  test('given a blank system prompt, no system message is sent', () => {
    const payload = buildChatCompletionPayload(
      messages,
      { ...DEFAULT_CONFIG, system_prompt: '   ' },
      DEFAULT_PARAMETER_ENABLED
    )

    expect(payload.messages).toEqual([{ role: 'user', content: 'hi' }])
  })
})

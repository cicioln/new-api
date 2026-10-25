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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../../../constants'
import type { Message } from '../../../types'
import { CompareCard, type CompareCardController } from '../compare-card'

const userMessage: Message = {
  key: 'u1',
  from: 'user',
  versions: [{ id: 'v1', content: 'hi' }],
}

function Harness(props: { messages: Message[] }) {
  const controllers = useRef(new Map<string, CompareCardController>())
  return (
    <QueryClientProvider client={new QueryClient()}>
      <CompareCard
        id='primary'
        model='gpt-5.2'
        models={[{ label: 'gpt-5.2', value: 'gpt-5.2' }]}
        onModelChange={vi.fn()}
        config={DEFAULT_CONFIG}
        parameterEnabled={DEFAULT_PARAMETER_ENABLED}
        messages={props.messages}
        updateMessages={vi.fn()}
        controllers={controllers}
        onGeneratingChange={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('CompareCard status', () => {
  test('given no messages, the card prompts to send and shows no status tag', () => {
    render(<Harness messages={[]} />)

    expect(
      screen.getByText('Send a prompt to compare model outputs.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Done/)).not.toBeInTheDocument()
  })

  test('given a completed reply with usage, the tag shows duration and the caption shows tokens', () => {
    render(
      <Harness
        messages={[
          userMessage,
          {
            key: 'a1',
            from: 'assistant',
            versions: [{ id: 'v2', content: 'Use SetLimit.' }],
            status: 'complete',
            durationMs: 2100,
            usage: {
              prompt_tokens: 3,
              completion_tokens: 412,
              total_tokens: 415,
            },
          },
        ]}
      />
    )

    expect(screen.getByText('Done · 2.1s')).toBeInTheDocument()
    expect(screen.getByText('412 tokens')).toBeInTheDocument()
  })

  test('given a reply still streaming, the tag reads generating', () => {
    render(
      <Harness
        messages={[
          userMessage,
          {
            key: 'a1',
            from: 'assistant',
            versions: [{ id: 'v2', content: 'Use' }],
            status: 'streaming',
          },
        ]}
      />
    )

    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })
})

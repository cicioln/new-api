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
import { SSE } from 'sse.js'
import { create } from 'zustand'

import { API_ENDPOINTS } from '@/features/playground/constants'
import {
  createStreamRequestController,
  type StreamEventSource,
} from '@/features/playground/hooks/use-stream-request'
import { getFreshAuthHeaders } from '@/lib/api'

export type PelicanRun = {
  prompt: string
  group: string
  stream: string
  reasoning: string
  /** False once the stream has ended and the result is being saved. */
  streaming: boolean
}

export type PelicanRunResult = {
  content: string
  reasoning: string
  reasoningMs?: number
  firstTokenMs?: number
  totalMs: number
  outputTokens?: number
}

type StartPelicanRun = {
  model: string
  prompt: string
  group: string
  /** Saves the result and returns the new record id, if any. */
  onComplete: (result: PelicanRunResult) => Promise<number | undefined>
  onError: (error: string) => void
}

type PelicanRunState = {
  /** Active runs keyed by model name. */
  runs: Record<string, PelicanRun>
  /** Record saved by the latest finished run of each model. */
  lastSaved: Record<string, number>
  start: (input: StartPelicanRun) => void
  stop: (model: string) => void
}

type StreamController = ReturnType<typeof createStreamRequestController>

// Runs live outside the dialog so closing it does not abort a paid test;
// reopening the model shows the same stream.
const controllers = new Map<string, StreamController>()

export const usePelicanRunStore = create<PelicanRunState>()((set, get) => {
  const patch = (model: string, next: Partial<PelicanRun>) =>
    set((state) => {
      const run = state.runs[model]
      if (!run) return state
      return { runs: { ...state.runs, [model]: { ...run, ...next } } }
    })

  const finish = (model: string) => {
    controllers.delete(model)
    set((state) => {
      const { [model]: _, ...runs } = state.runs
      return { runs }
    })
  }

  return {
    runs: {},
    lastSaved: {},
    start: ({ model, prompt, group, onComplete, onError }) => {
      if (get().runs[model]) return
      const controller = createStreamRequestController({
        getHeaders: getFreshAuthHeaders,
        createSource: (payload, headers) =>
          new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
            headers,
            method: 'POST',
            payload: JSON.stringify(payload),
          }) as StreamEventSource,
        // Run state is tracked here; the controller's flag is not needed.
        setStreaming: () => {},
      })
      controllers.set(model, controller)
      set((state) => {
        const { [model]: _, ...lastSaved } = state.lastSaved
        return {
          lastSaved,
          runs: {
            ...state.runs,
            [model]: {
              prompt,
              group,
              stream: '',
              reasoning: '',
              streaming: true,
            },
          },
        }
      })

      const started = performance.now()
      let firstTokenMs: number | undefined
      let content = ''
      let thinking = ''
      // Thinking time runs from the first reasoning chunk to the first answer
      // chunk, or to the end when the model never writes an answer.
      let thinkingStarted: number | undefined
      let thinkingEnded: number | undefined
      let outputTokens: number | undefined

      void controller.send(
        {
          model,
          group: group || undefined,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        },
        {
          onUpdate: (type, chunk) => {
            firstTokenMs ??= performance.now() - started
            if (type === 'reasoning') {
              thinkingStarted ??= performance.now()
              thinking += chunk
              patch(model, { reasoning: thinking })
              return
            }
            if (thinkingStarted !== undefined)
              thinkingEnded ??= performance.now()
            content += chunk
            patch(model, { stream: content })
          },
          onUsage: (usage) => {
            outputTokens = usage.completion_tokens
          },
          onComplete: () => {
            patch(model, { streaming: false })
            const now = performance.now()
            void onComplete({
              content,
              reasoning: thinking,
              reasoningMs:
                thinkingStarted === undefined
                  ? undefined
                  : (thinkingEnded ?? now) - thinkingStarted,
              firstTokenMs:
                firstTokenMs === undefined
                  ? undefined
                  : Math.round(firstTokenMs),
              totalMs: now - started,
              outputTokens,
            })
              .then((id) => {
                if (id === undefined) return
                set((state) => ({
                  lastSaved: { ...state.lastSaved, [model]: id },
                }))
              })
              .finally(() => finish(model))
          },
          onError: (error) => {
            finish(model)
            onError(error)
          },
        }
      )
    },
    stop: (model) => {
      controllers.get(model)?.stop()
      finish(model)
    },
  }
})

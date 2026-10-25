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
import { CircleCheck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

type SampleLang = 'python' | 'curl' | 'node'

const LANG_LABELS: Record<SampleLang, string> = {
  python: 'Python',
  curl: 'cURL',
  node: 'Node.js',
}

/** Returns the snippet split around the base URL so it can be highlighted. */
function buildSample(lang: SampleLang, greeting: string): [string, string] {
  const key = 'sk-xxxxxxxx'
  if (lang === 'curl') {
    return [
      'curl ',
      `/chat/completions \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "gpt-5.2",\n    "messages": [{"role": "user", "content": "${greeting}"}]\n  }'`,
    ]
  }
  if (lang === 'node') {
    return [
      'import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "',
      `",\n  apiKey: "${key}",\n});\n\nconst r = await client.chat.completions.create({\n  model: "deepseek-v4",\n  messages: [{ role: "user", content: "${greeting}" }],\n});\nconsole.log(r.choices[0].message.content);`,
    ]
  }
  return [
    'from openai import OpenAI\n\nclient = OpenAI(\n    base_url="',
    `",\n    api_key="${key}",\n)\n\nr = client.chat.completions.create(\n    model="claude-opus-5-5",\n    messages=[{"role": "user", "content": "${greeting}"}],\n)\nprint(r.choices[0].message.content)`,
  ]
}

export function QuickStart() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [lang, setLang] = useState<SampleLang>('python')
  const { copyToClipboard } = useCopyToClipboard()

  const origin =
    (typeof status?.server_address === 'string' &&
      status.server_address.trim().replace(/\/+$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const baseUrl = `${origin}/v1`
  const [before, after] = buildSample(lang, t('Hello'))
  const endpoint = (path: string) => (
    <code className='bg-muted rounded px-1.5 py-px font-mono text-[12.5px]'>
      {path}
    </code>
  )

  const points: { id: string; content: ReactNode }[] = [
    {
      id: 'endpoints',
      content: (
        <>
          {t('Compatible with')} {endpoint('/v1/chat/completions')}
          {t('Endpoint list separator')}
          {endpoint('/v1/messages')}
          {t('Endpoint list separator')}
          {endpoint('/v1/embeddings')} {t('and other common endpoints')}
        </>
      ),
    },
    {
      id: 'vendors',
      content: t(
        'One key calls models from OpenAI, Anthropic, Google, DeepSeek and more'
      ),
    },
    {
      id: 'clients',
      content: t(
        'Clients like Cherry Studio, Cursor, Dify and n8n work once you enter the URL'
      ),
    },
    {
      id: 'protocol',
      content: t(
        'Streaming, function calling and image input pass through the original protocol'
      ),
    },
  ]

  return (
    <section className='pt-24'>
      <h2 className='mb-2 text-[30px] font-semibold tracking-tight'>
        {t('Change one line: base_url')}
      </h2>
      <p className='text-subtle-foreground mb-7 text-[14.5px]'>
        {t(
          'Existing OpenAI SDK code stays the same; switch the address and key to call every model.'
        )}
      </p>
      <div className='grid items-center gap-8 min-[1101px]:grid-cols-[1fr_1.25fr]'>
        <ul className='grid gap-3.5'>
          {points.map((point) => (
            <li
              key={point.id}
              className='text-muted-foreground flex min-w-0 gap-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]'
            >
              <CircleCheck
                className='text-success mt-0.5 size-[18px] shrink-0'
                strokeWidth={1.8}
                aria-hidden
              />
              <span className='min-w-0'>{point.content}</span>
            </li>
          ))}
        </ul>
        <div className='min-w-0 overflow-hidden rounded-xl bg-[#141518]'>
          <div className='flex items-center gap-1 border-b border-[#2a2c31] px-2.5 py-2'>
            {(Object.keys(LANG_LABELS) as SampleLang[]).map((key) => (
              <button
                key={key}
                type='button'
                aria-pressed={lang === key}
                onClick={() => setLang(key)}
                className={cn(
                  'h-[26px] rounded-md px-2.5 text-[12.5px]',
                  lang === key
                    ? 'bg-[#24262b] text-[#e8e6df]'
                    : 'text-[#8a8c93] hover:text-[#e8e6df]'
                )}
              >
                {LANG_LABELS[key]}
              </button>
            ))}
            <button
              type='button'
              onClick={() =>
                void copyToClipboard(`${before}${baseUrl}${after}`)
              }
              className='ms-auto h-[26px] rounded-md px-2.5 text-[12.5px] text-[#8a8c93] hover:text-[#e8e6df]'
            >
              {t('Copy')}
            </button>
          </div>
          <pre className='m-0 overflow-auto px-5 py-[18px] font-mono text-[12.5px] leading-[1.65] whitespace-pre text-[#e8e6df]'>
            <code>
              {before}
              <span className='text-[#f5b26b]'>{baseUrl}</span>
              {after}
            </code>
          </pre>
        </div>
      </div>
    </section>
  )
}

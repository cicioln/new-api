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
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'

type SampleLang = 'python' | 'curl' | 'node'

const LANG_LABELS: Record<SampleLang, string> = {
  python: 'Python',
  curl: 'cURL',
  node: 'Node.js',
}

/** Returns the snippet split around the base URL so it can be highlighted. */
function buildSample(lang: SampleLang): [string, string] {
  const key = 'sk-xxxxxxxx'
  if (lang === 'curl') {
    return [
      'curl ',
      `/chat/completions \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "gpt-5.2",\n    "messages": [{"role": "user", "content": "Hello"}]\n  }'`,
    ]
  }
  if (lang === 'node') {
    return [
      'import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "',
      `",\n  apiKey: "${key}",\n});\n\nconst r = await client.chat.completions.create({\n  model: "deepseek-v4",\n  messages: [{ role: "user", content: "Hello" }],\n});\nconsole.log(r.choices[0].message.content);`,
    ]
  }
  return [
    'from openai import OpenAI\n\nclient = OpenAI(\n    base_url="',
    `",\n    api_key="${key}",\n)\n\nr = client.chat.completions.create(\n    model="claude-opus-5-5",\n    messages=[{"role": "user", "content": "Hello"}],\n)\nprint(r.choices[0].message.content)`,
  ]
}

export function QuickStart() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [lang, setLang] = useState<SampleLang>('python')

  const origin =
    (typeof status?.server_address === 'string' &&
      status.server_address.trim().replace(/\/+$/, '')) ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  const baseUrl = `${origin}/v1`
  const [before, after] = buildSample(lang)

  const points = [
    t(
      'Compatible with common endpoints such as /v1/chat/completions, /v1/messages and /v1/embeddings'
    ),
    t('One key calls models from OpenAI, Anthropic, Google, DeepSeek and more'),
    t(
      'Clients like Cherry Studio, Cursor, Dify and n8n work once you enter the URL'
    ),
    t(
      'Streaming, function calling and image input pass through the original protocol'
    ),
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
      <div className='grid items-center gap-8 lg:grid-cols-[1fr_1.25fr]'>
        <ul className='grid gap-3.5'>
          {points.map((point) => (
            <li
              key={point}
              className='text-muted-foreground flex min-w-0 gap-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]'
            >
              <Check
                className='text-success mt-0.5 size-[18px] shrink-0'
                aria-hidden
              />
              <span className='min-w-0'>{point}</span>
            </li>
          ))}
        </ul>
        <div className='bg-code text-code-foreground min-w-0 overflow-hidden rounded-xl'>
          <div className='flex items-center gap-1 border-b border-white/10 px-2.5 py-2'>
            <Tabs
              value={lang}
              onValueChange={(value) => setLang(value as SampleLang)}
            >
              <TabsList className='bg-transparent p-0'>
                {(Object.keys(LANG_LABELS) as SampleLang[]).map((key) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className='h-[26px] px-2.5 text-[12.5px] text-white/55 hover:text-white data-active:bg-white/10 data-active:text-white'
                  >
                    {LANG_LABELS[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <CopyButton
              value={`${before}${baseUrl}${after}`}
              size='icon'
              className='ms-auto size-7 text-white/60 hover:bg-white/10 hover:text-white'
              tooltip={t('Copy')}
            />
          </div>
          <pre className='overflow-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed'>
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

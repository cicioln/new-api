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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { LogoMark } from '@/components/layout/components/logo-mark'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
}

// Decorative request log shown on the dark brand panel.
const STREAM_ROWS = [
  { path: '/v1/chat/completions', model: 'claude-opus-5-5', ms: '312ms' },
  { path: '/v1/messages', model: 'claude-sonnet-5-5', ms: '188ms' },
  { path: '/v1/chat/completions', model: 'gpt-5.2', ms: '241ms' },
  { path: '/v1/embeddings', model: 'text-embedding-3', ms: '42ms' },
  { path: '/v1beta/generateContent', model: 'gemini-3-pro', ms: '406ms' },
  { path: '/v1/chat/completions', model: 'deepseek-v4', ms: '275ms' },
  { path: '/v1/images/generations', model: 'gpt-image-2', ms: '3.2s' },
  { path: '/v1/messages', model: 'claude-opus-5-5', ms: '298ms' },
] as const

const HANDLED_REQUESTS = 1284903

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <aside className='relative hidden flex-col overflow-hidden border-r border-[#23252a] bg-[#141518] px-12 py-10 text-[#f2f1ec] lg:flex'>
        <AuthBrand inverted />
        <div
          aria-hidden
          className='absolute top-[120px] right-10 left-12 font-mono text-xs leading-[2] opacity-50'
        >
          {STREAM_ROWS.map((row) => (
            <div
              key={`${row.path}-${row.model}-${row.ms}`}
              className='flex gap-3.5 overflow-hidden whitespace-nowrap'
            >
              <span className='text-[#3dd68c]'>200</span>
              <span>POST</span>
              <span>{row.path}</span>
              <span>{row.model}</span>
              <span>{row.ms}</span>
            </div>
          ))}
        </div>
        <blockquote className='relative z-10 mt-auto max-w-[440px] text-[26px] leading-[1.35] font-medium tracking-[-0.02em]'>
          {t(
            '“Delete the integration code for six vendors and keep one base_url.”'
          )}
        </blockquote>
        <p className='relative z-10 mt-4 text-[13px] opacity-55'>
          {t('{{value}} requests processed today', {
            value: HANDLED_REQUESTS.toLocaleString('en-US'),
          })}
        </p>
      </aside>

      <main className='grid place-items-center px-6 py-10'>
        <div className='flex w-full max-w-[380px] flex-col'>
          <AuthBrand className='mb-8 lg:hidden' />
          {props.children}
        </div>
      </main>
    </div>
  )
}

function AuthBrand(props: { inverted?: boolean; className?: string }) {
  const { systemName, loading } = useSystemConfig()
  const markClassName = props.inverted
    ? 'bg-[#f2f1ec] text-[#111214] after:border-[#141518]'
    : undefined

  return (
    <Link
      to='/'
      className={cn(
        'relative z-10 flex w-fit items-center gap-2.5 text-base font-bold tracking-[-0.01em] transition-opacity hover:opacity-80',
        props.className
      )}
    >
      <LogoMark className={markClassName} />
      {loading ? (
        <Skeleton className='h-5 w-24' />
      ) : (
        <span>{systemName || 'New API'}</span>
      )}
    </Link>
  )
}

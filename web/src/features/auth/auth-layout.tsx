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

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

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
  { path: '/v1/responses', model: 'gpt-5.2-codex', ms: '330ms' },
] as const

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <aside className='relative hidden flex-col overflow-hidden border-r border-[#23252a] bg-[#141518] px-12 py-10 text-[#f2f1ec] lg:flex'>
        <Link
          to='/'
          className='relative z-10 flex w-fit items-center gap-2.5 transition-opacity hover:opacity-80'
        >
          <AuthBrand logo={logo} systemName={systemName} loading={loading} />
        </Link>
        <div
          aria-hidden
          className='absolute inset-x-12 top-[120px] font-mono text-xs leading-loose opacity-50'
        >
          {STREAM_ROWS.map((row) => (
            <div
              key={`${row.path}-${row.model}`}
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
        <blockquote className='relative z-10 mt-auto max-w-[440px] text-[26px] leading-snug font-medium tracking-tight'>
          {t(
            '“Delete the integration code for six vendors and keep one base_url.”'
          )}
        </blockquote>
        <p className='relative z-10 mt-4 text-[13px] opacity-55'>
          {t('Unified AI Gateway')}
        </p>
      </aside>

      <div className='flex flex-col'>
        <Link
          to='/'
          className='m-6 flex w-fit items-center gap-2.5 transition-opacity hover:opacity-80 lg:hidden'
        >
          <AuthBrand logo={logo} systemName={systemName} loading={loading} />
        </Link>
        <div className='flex flex-1 items-center justify-center px-6 py-10'>
          <div className='flex w-full max-w-[380px] flex-col space-y-2'>
            {props.children}
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthBrand(props: {
  logo: string
  systemName: string
  loading: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className='relative size-7'>
        {props.loading ? (
          <Skeleton className='absolute inset-0 rounded-md' />
        ) : (
          <img
            src={props.logo}
            alt={t('Logo')}
            className='size-7 rounded-md object-cover'
          />
        )}
      </div>
      {props.loading ? (
        <Skeleton className='h-5 w-24' />
      ) : (
        <span className='text-[15px] font-semibold tracking-tight'>
          {props.systemName}
        </span>
      )}
    </>
  )
}

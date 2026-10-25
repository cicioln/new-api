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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LEGAL_MARKDOWN_CLASS,
  LegalFrame,
} from '@/features/legal/legal-document'
import { useStatus } from '@/hooks/use-status'
import { isHttpUrl, isLikelyHtml } from '@/lib/content-format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getAboutContent } from './api'

const LINK = 'underline underline-offset-2'

function AboutTitle(props: { name: string }) {
  const { t } = useTranslation()
  return (
    <h1 className='mb-3 text-[34px] font-[650] tracking-[-0.02em]'>
      {t('About')} {props.name}
    </h1>
  )
}

function EmptyAboutState(props: { name: string }) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <>
      <AboutTitle name={props.name} />
      <p className='text-muted-foreground text-[15px] leading-[1.85]'>
        {t(
          'The administrator has not configured any about content yet. You can set it in the settings page, supporting HTML or URL.'
        )}
      </p>
      <h2 className='mt-8 mb-2 text-lg font-semibold'>{t('Open source')}</h2>
      <p className='text-muted-foreground text-[15px] leading-[1.85]'>
        <a
          href='https://github.com/QuantumNous/new-api'
          target='_blank'
          rel='noopener noreferrer'
          className={LINK}
        >
          {t('NewAPI')}
        </a>{' '}
        © {currentYear}{' '}
        <a
          href='https://github.com/QuantumNous'
          target='_blank'
          rel='noopener noreferrer'
          className={LINK}
        >
          {t('QuantumNous')}
        </a>{' '}
        {t('| Based on')}{' '}
        <a
          href='https://github.com/songquanpeng/one-api'
          target='_blank'
          rel='noopener noreferrer'
          className={LINK}
        >
          {t('One API')}
        </a>{' '}
        © 2023{' '}
        <a
          href='https://github.com/songquanpeng'
          target='_blank'
          rel='noopener noreferrer'
          className={LINK}
        >
          {t('JustSong')}
        </a>
      </p>
      <p className='text-muted-foreground text-[15px] leading-[1.85]'>
        {t('This project must be used in compliance with the')}{' '}
        <a
          href='https://github.com/QuantumNous/new-api/blob/main/LICENSE'
          target='_blank'
          rel='noopener noreferrer'
          className={LINK}
        >
          {t('AGPL v3.0 License')}
        </a>
        .
      </p>
    </>
  )
}

export function About() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: async () => requireServerSuccess(await getAboutContent()),
  })

  const name = status?.system_name || 'New API'
  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isHttpUrl(rawContent)
  const contentIsHtml = hasContent && isLikelyHtml(rawContent)

  if (isLoading) {
    return (
      <LegalFrame>
        <div className='flex flex-col gap-4'>
          <Skeleton className='h-9 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </LegalFrame>
    )
  }

  if (!hasContent) {
    return (
      <LegalFrame>
        <EmptyAboutState name={name} />
      </LegalFrame>
    )
  }

  if (isUrl) {
    return (
      <PublicLayout showMainContainer={false}>
        <iframe
          src={rawContent}
          className='mt-16 h-[calc(100vh-4rem)] w-full border-0'
          title={t('About')}
          sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts'
        />
      </PublicLayout>
    )
  }

  if (contentIsHtml) {
    return (
      <LegalFrame>
        <RichContent mode='html' htmlVariant='isolated' content={rawContent} />
      </LegalFrame>
    )
  }

  return (
    <LegalFrame>
      <AboutTitle name={name} />
      <RichContent
        mode='markdown'
        content={rawContent}
        className={LEGAL_MARKDOWN_CLASS}
      />
    </LegalFrame>
  )
}

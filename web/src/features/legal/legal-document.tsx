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
import { ExternalLink, FileWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isHttpUrl, isLikelyHtml } from '@/lib/content-format'

import type { LegalDocumentResponse } from './types'

type LegalDocumentProps = {
  title: string
  queryKey: string
  fetchDocument: () => Promise<LegalDocumentResponse>
  emptyMessage: string
}

/** Document typography shared by the legal and about pages. */
export const LEGAL_MARKDOWN_CLASS =
  'text-muted-foreground text-[15px] leading-[1.85] [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-0 [&_p]:leading-[1.85] [&_li]:my-0 [&_li]:pl-0 [&_ul]:my-0 [&_ul]:pl-5 [&_a]:text-inherit [&_a]:underline [&_code]:bg-muted [&_code]:rounded-[4px] [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[13px]'

type LegalFrameProps = {
  children: React.ReactNode
}

export function LegalFrame(props: LegalFrameProps) {
  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto max-w-[1360px] px-4 pt-16 md:px-6'>
        <article
          data-testid='legal-article'
          className='mx-auto max-w-[760px] pt-14 pb-24'
        >
          {props.children}
        </article>
      </div>
      <Footer />
    </PublicLayout>
  )
}

export function LegalDocument(props: LegalDocumentProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: [props.queryKey],
    queryFn: props.fetchDocument,
    staleTime: 10 * 60 * 1000,
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isHttpUrl(rawContent)
  const contentIsHtml = hasContent && isLikelyHtml(rawContent)
  const success = data?.success ?? false

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

  if (!success || !hasContent) {
    return (
      <LegalFrame>
        <EmptyState
          icon={FileWarning}
          title={props.title}
          description={data?.message || props.emptyMessage}
          bordered
        />
      </LegalFrame>
    )
  }

  if (isUrl) {
    return (
      <LegalFrame>
        <h1 className='mb-3 text-[34px] font-semibold tracking-tight'>
          {props.title}
        </h1>
        <p className='text-muted-foreground mb-6 text-[15px] leading-7'>
          {t(
            'The administrator configured an external link for this document.'
          )}
        </p>
        <Button
          render={
            <a href={rawContent} target='_blank' rel='noopener noreferrer' />
          }
        >
          {t('View document')}
          <ExternalLink aria-hidden='true' />
        </Button>
      </LegalFrame>
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
      <h1 className='mb-3 text-[34px] font-semibold tracking-tight'>
        {props.title}
      </h1>
      <RichContent
        mode='markdown'
        content={rawContent}
        className={LEGAL_MARKDOWN_CLASS}
      />
    </LegalFrame>
  )
}

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
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ErrorFrame } from './error-frame'

const FEEDBACK_URL = 'https://github.com/QuantumNous/new-api/issues'

type GeneralErrorProps = {
  className?: string
  minimal?: boolean
  error?: unknown
  /** Status shown when the error itself carries none, e.g. on the /500 route */
  code?: number
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const response = (error as Record<string, unknown>).response
  if (typeof response !== 'object' || response === null) return undefined
  const status = (response as Record<string, unknown>).status
  return typeof status === 'number' ? status : undefined
}

export function GeneralError(props: GeneralErrorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const error = props.error
  useEffect(() => {
    if (
      !(error instanceof Error) ||
      (error.name !== 'ChunkLoadError' &&
        !/^Loading (CSS )?chunk .+ failed\./.test(error.message))
    ) {
      return
    }

    // Recover only when the failed route is displayed, never on intent preload.
    // Keep the marker across reloads so a persistent failure shows this page.
    try {
      const key = `tanstack_router_reload:${error.message}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // Without a persistent marker, reloading could loop indefinitely.
      return
    }
    window.location.reload()
  }, [error])

  const status = getHttpStatus(error) ?? props.code
  const isRateLimited = status === 429
  const title = isRateLimited
    ? t('Too many requests')
    : t('Something went wrong')
  const description = isRateLimited
    ? t('Please wait a moment before trying again.')
    : t(
        'The request was not processed successfully. Refresh to try again. If the problem persists, contact the administrator.'
      )

  return (
    <ErrorFrame
      className={props.className}
      code={!props.minimal ? status : undefined}
      title={title}
      actions={
        !props.minimal && (
          <>
            <Button size='sm' onClick={() => window.location.reload()}>
              {t('Refresh and retry')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => navigate({ to: '/' })}
            >
              {t('Back to home page')}
            </Button>
          </>
        )
      }
    >
      {description}
      {!props.minimal && (
        <a
          href={FEEDBACK_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='hover:text-foreground mt-4 block text-xs underline-offset-4 hover:underline'
        >
          {t('Report an issue')}
        </a>
      )}
    </ErrorFrame>
  )
}

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
import { useParams } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'

import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { SystemOption } from '../types'
import { SettingsNav } from './settings-nav'
import { SettingsPageProvider } from './settings-page-context'

type SettingsPageProps<
  TSettings extends Record<string, string | number | boolean | unknown[]>,
  TSectionId extends string,
  TExtraArgs extends unknown[] = [],
> = {
  routePath: string
  defaultSettings: TSettings
  defaultSection: TSectionId
  getSectionContent: (
    sectionId: TSectionId,
    settings: TSettings,
    ...extraArgs: TExtraArgs
  ) => ReactNode
  getSectionMeta: (sectionId: TSectionId) => {
    titleKey: string
    cardTitleKey?: string
    descriptionKey?: string
  }
  extraArgs?: TExtraArgs
  loadingMessage?: string
  resolveSettings?: (
    settings: TSettings,
    raw: SystemOption[] | undefined
  ) => TSettings
}

type SettingsPageFrameProps = {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

function SettingsPageFrame(props: SettingsPageFrameProps) {
  const { t } = useTranslation()
  const [actionsContainer, setActionsContainer] =
    useState<HTMLDivElement | null>(null)
  const [titleStatusContainer, setTitleStatusContainer] =
    useState<HTMLSpanElement | null>(null)

  return (
    <SettingsPageProvider
      actionsContainer={actionsContainer}
      titleStatusContainer={titleStatusContainer}
    >
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('System Settings')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t(
            'Changes take effect immediately after saving, no restart needed.'
          )}
        </SectionPageLayout.Description>
        <SectionPageLayout.Content>
          <div className='grid items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]'>
            <SettingsNav />
            <div className='min-w-0'>
              <section className='bg-card min-w-0 rounded-lg border p-[18px]'>
                <div className='flex items-center justify-between gap-2'>
                  <h3 className='text-sm font-semibold'>{props.title}</h3>
                  <span
                    ref={setTitleStatusContainer}
                    className='inline-flex min-w-0 shrink-0 items-center'
                  />
                </div>
                {props.description != null && (
                  <p className='text-subtle-foreground mt-0.5 text-[12.5px]'>
                    {props.description}
                  </p>
                )}
                <div className='mt-3.5 flex min-w-0 flex-col gap-4'>
                  {props.children}
                </div>
              </section>
              <div
                ref={setActionsContainer}
                className='mt-3.5 flex flex-wrap items-center justify-end gap-2 empty:hidden'
              />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    </SettingsPageProvider>
  )
}

/**
 * Generic settings page component
 * Handles loading state, data fetching, and section rendering
 */
export function SettingsPage<
  TSettings extends Record<string, string | number | boolean | unknown[]>,
  TSectionId extends string,
  TExtraArgs extends unknown[] = [],
>({
  routePath,
  defaultSettings,
  defaultSection,
  getSectionContent,
  getSectionMeta,
  extraArgs,
  loadingMessage = 'Loading settings...',
  resolveSettings,
}: SettingsPageProps<TSettings, TSectionId, TExtraArgs>) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useSystemOptions()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = useParams({ from: routePath as any })
  const activeSection = (params?.section ?? defaultSection) as TSectionId
  const sectionMeta = getSectionMeta(activeSection)
  const cardTitle = t(sectionMeta.cardTitleKey ?? sectionMeta.titleKey)
  const cardDescription = sectionMeta.descriptionKey
    ? t(sectionMeta.descriptionKey)
    : undefined

  const settings = useMemo(() => {
    const baseSettings = getOptionValue(
      data?.data,
      defaultSettings
    ) as TSettings
    return resolveSettings
      ? resolveSettings(baseSettings, data?.data)
      : baseSettings
  }, [data?.data, defaultSettings, resolveSettings])

  if (isLoading) {
    return (
      <SettingsPageFrame title={cardTitle} description={cardDescription}>
        <div className='text-muted-foreground flex min-h-40 items-center justify-center text-sm'>
          {t(loadingMessage)}
        </div>
      </SettingsPageFrame>
    )
  }

  if (isError && !data) {
    return (
      <SettingsPageFrame title={cardTitle} description={cardDescription}>
        <ErrorState
          title={t('Failed to load settings')}
          onRetry={() => void refetch()}
        />
      </SettingsPageFrame>
    )
  }

  const sectionContent = getSectionContent(
    activeSection,
    settings,
    ...((extraArgs ?? []) as TExtraArgs)
  )

  return (
    <SettingsPageFrame title={cardTitle} description={cardDescription}>
      {sectionContent}
    </SettingsPageFrame>
  )
}

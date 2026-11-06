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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const VIDEO_KEY = 'video_setting.retention_days'
const IMAGE_KEY = 'video_setting.image_retention_days'

const mediaStorageSchema = z.object({
  retention_days: z.number().int().min(0),
  image_retention_days: z.number().int().min(0),
})

type MediaStorageFormValues = z.infer<typeof mediaStorageSchema>

export function VideoStorageSection(props: {
  defaultValues: {
    'video_setting.retention_days': number
    'video_setting.image_retention_days': number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const savedVideo = props.defaultValues[VIDEO_KEY]
  const savedImage = props.defaultValues[IMAGE_KEY]
  const formDefaults = useMemo(
    () => ({ retention_days: savedVideo, image_retention_days: savedImage }),
    [savedVideo, savedImage]
  )
  const form = useForm<MediaStorageFormValues>({
    resolver: zodResolver(mediaStorageSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: MediaStorageFormValues) => {
    if (values.retention_days !== savedVideo) {
      await updateOption.mutateAsync({
        key: VIDEO_KEY,
        value: values.retention_days,
      })
    }
    if (values.image_retention_days !== savedImage) {
      await updateOption.mutateAsync({
        key: IMAGE_KEY,
        value: values.image_retention_days,
      })
    }
  }

  return (
    <SettingsSection title={t('Media Storage')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='retention_days'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Video retention days')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    className='max-w-48'
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Generated videos are stored on this server. Videos older than this are deleted automatically; 0 keeps them permanently.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='image_retention_days'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Image retention days')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    className='max-w-48'
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Images generated in the studio are stored on this server. Images older than this are deleted automatically; 0 keeps them permanently.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

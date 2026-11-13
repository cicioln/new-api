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
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { createChannel, updateChannel } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
  type ChannelFormValues,
} from '../lib'
import type { Channel } from '../types'

type UseChannelMutateFormParams = {
  currentRow?: Channel | null
  isEditing: boolean
  isMultiKeyChannel: boolean
  onSuccess: () => void
}

const SENSITIVE_UPDATE_FIELDS = [
  'type',
  'key',
  'base_url',
  'openai_organization',
  'param_override',
  'header_override',
  'setting',
  'settings',
  'other',
] satisfies (keyof Channel)[]

export function useChannelMutateForm(props: UseChannelMutateFormParams) {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.auth.user)
  const canEditSensitive = hasPermission(
    currentUser,
    ADMIN_PERMISSION_RESOURCES.CHANNEL,
    ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
  )

  return useMutation({
    mutationFn: async (data: ChannelFormValues): Promise<string> => {
      if (props.isEditing && props.currentRow) {
        const payload = transformFormDataToUpdatePayload(
          data,
          props.currentRow.id
        )
        if (!data.key?.trim()) {
          delete payload.key
        }
        if (!canEditSensitive) {
          for (const field of SENSITIVE_UPDATE_FIELDS) {
            delete payload[field]
          }
        }
        const isTargetMultiKey =
          data.multi_key_mode === 'multi_to_single' ||
          (props.isMultiKeyChannel && data.multi_key_mode !== 'single')
        const switchedToSingle =
          props.isMultiKeyChannel && data.multi_key_mode === 'single'
        const payloadWithKeyMode =
          canEditSensitive &&
          isTargetMultiKey &&
          data.key?.trim() &&
          data.key_mode
            ? {
                ...payload,
                key_mode: data.key_mode,
              }
            : payload

        const prevKeyConcurrency =
          props.currentRow.channel_info?.key_concurrency || 0
        const nextKeyConcurrency = data.key_concurrency || 0
        const keyConcurrencyChanged = nextKeyConcurrency !== prevKeyConcurrency

        const prevConcList =
          props.currentRow.channel_info?.multi_key_concurrency_list || {}
        const nextConcList = data.multi_key_concurrency_list || {}
        const concListChanged =
          JSON.stringify(prevConcList) !== JSON.stringify(nextConcList)

        const response = await updateChannel(props.currentRow.id, {
          ...payloadWithKeyMode,
          ...(canEditSensitive && isTargetMultiKey
            ? { multi_key_mode: data.multi_key_type }
            : {}),
          ...(canEditSensitive && switchedToSingle
            ? { multi_key_mode: 'single' }
            : {}),
          ...(keyConcurrencyChanged
            ? { key_concurrency: nextKeyConcurrency }
            : {}),
          ...(concListChanged
            ? { multi_key_concurrency_list: nextConcList }
            : {}),
        })
        if (!response.success) {
          throw createServerError(response, t(ERROR_MESSAGES.UPDATE_FAILED))
        }
        return SUCCESS_MESSAGES.UPDATED
      }

      const payload = transformFormDataToCreatePayload(data)
      const response = await createChannel(payload)
      if (!response.success) {
        throw createServerError(response, t(ERROR_MESSAGES.CREATE_FAILED))
      }
      return SUCCESS_MESSAGES.CREATED
    },
    onSuccess: (messageKey) => {
      toast.success(t(messageKey))
      props.onSuccess()
    },
    onError: (error: unknown) => {
      handleServerError(error, t(ERROR_MESSAGES.CREATE_FAILED))
    },
  })
}

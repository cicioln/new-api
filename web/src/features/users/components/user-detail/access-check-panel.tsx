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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { checkUserAccess, updateUserTokenGroup } from '../../api'
import { describeAccessCheckStep } from '../../lib/access-check'
import type {
  AccessCheckResult,
  AdminUserToken,
  UserGroupOverview,
} from '../../types'
import { useUsers } from '../users-provider'

// Sentinel values for the comboboxes; group names cannot start with "__".
const NO_TOKEN = '__none__'
const KEEP_GROUP = '__keep__'
const USER_GROUP = '__user__'

interface AccessCheckPanelProps {
  userId: number
  username: string
  tokens: AdminUserToken[]
  groups: UserGroupOverview[]
}

function StepIcon(props: { result: string }) {
  if (props.result === 'pass') {
    return <CheckCircle2 className='text-success size-4' aria-hidden='true' />
  }
  if (props.result === 'fail') {
    return <XCircle className='text-destructive size-4' aria-hidden='true' />
  }
  return <Info className='text-muted-foreground size-4' aria-hidden='true' />
}

export function AccessCheckPanel(props: AccessCheckPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { requestVerification, verificationActive } = useUsers()
  const allModels = useMemo(
    () => [...new Set(props.groups.flatMap((group) => group.models))].sort(),
    [props.groups]
  )
  const [model, setModel] = useState('')
  const [tokenValue, setTokenValue] = useState(
    props.tokens[0] ? String(props.tokens[0].id) : NO_TOKEN
  )
  const [groupValue, setGroupValue] = useState(KEEP_GROUP)
  const [moveTarget, setMoveTarget] = useState<string | null>(null)

  const token = props.tokens.find((item) => String(item.id) === tokenValue)
  let simulatedGroup: string | undefined
  if (groupValue === USER_GROUP) simulatedGroup = ''
  else if (groupValue !== KEEP_GROUP) simulatedGroup = groupValue

  const check = useQuery({
    queryKey: [
      'user-access-check',
      props.userId,
      model,
      token?.id ?? 0,
      simulatedGroup ?? null,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await checkUserAccess(props.userId, {
          model,
          tokenId: token?.id,
          group: simulatedGroup,
        })
      ).data as AccessCheckResult,
    enabled: model !== '',
  })

  const moveToken = useMutation({
    mutationFn: async (group: string) => {
      if (!token) return false
      const proof = await requestVerification({
        scope: 'admin.user.update',
        context: { user_id: props.userId },
        title: t('Verify to change token group'),
        description: t(
          'Confirm your identity before changing the account {{username}}.',
          { username: props.username }
        ),
      })
      if (!proof) return false
      requireServerSuccess(
        await updateUserTokenGroup(
          props.userId,
          token.id,
          group,
          proof.proof_token
        )
      )
      return true
    },
    onSuccess: (changed) => {
      if (!changed) return
      toast.success(t('Token group updated'))
      setGroupValue(KEEP_GROUP)
      void queryClient.invalidateQueries({
        queryKey: ['user-detail-tokens', props.userId],
      })
      void queryClient.invalidateQueries({
        queryKey: ['user-access-check', props.userId],
      })
    },
    onError: (error) =>
      handleServerError(
        AuthOperationError.from(error),
        t('Failed to update token group')
      ),
  })

  const result = check.data
  const fixGroup = result && !result.allowed ? result.groups_with_model[0] : ''
  const simulatedOk =
    result?.allowed && simulatedGroup !== undefined && simulatedGroup !== ''
  const suggestedGroup = simulatedOk ? simulatedGroup : fixGroup

  const groupOptions = [
    { value: KEEP_GROUP, label: t('Current token setting') },
    { value: USER_GROUP, label: t('No group (use the user group)') },
    ...props.groups.map((group) => ({
      value: group.group,
      label: group.group,
    })),
  ]

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='access-check-model'>{t('Model')}</Label>
          <Combobox
            id='access-check-model'
            options={allModels.map((name) => ({ value: name, label: name }))}
            value={model}
            onValueChange={(value) => setModel(value ?? '')}
            allowCustomValue
            placeholder={t('Enter or pick a model')}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='access-check-token'>{t('Token')}</Label>
          <Combobox
            id='access-check-token'
            options={[
              { value: NO_TOKEN, label: t('No token') },
              ...props.tokens.map((item) => ({
                value: String(item.id),
                label: `${item.name} (#${item.id})`,
              })),
            ]}
            value={tokenValue}
            onValueChange={(value) => setTokenValue(value ?? NO_TOKEN)}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='access-check-group'>
            {t('Token group (what-if)')}
          </Label>
          <Combobox
            id='access-check-group'
            options={groupOptions}
            value={groupValue}
            onValueChange={(value) => setGroupValue(value ?? KEEP_GROUP)}
          />
        </div>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          'The check follows the gateway channel selection and changes nothing. The what-if group only affects this check.'
        )}
      </p>

      {model === '' && (
        <p className='text-muted-foreground rounded-md border border-dashed p-4 text-sm'>
          {t('Pick a model to check whether this user can call it.')}
        </p>
      )}
      {model !== '' && check.isLoading && <Skeleton className='h-32 w-full' />}
      {result && (
        <div className='flex flex-col gap-3'>
          <ol className='flex flex-col gap-2'>
            {result.steps.map((step) => {
              const described = describeAccessCheckStep(step, t)
              return (
                <li key={step.key} className='flex gap-2.5'>
                  <span className='mt-0.5 shrink-0'>
                    <StepIcon result={step.result} />
                  </span>
                  <div className='min-w-0'>
                    <div className='text-sm font-medium'>{described.title}</div>
                    {described.detail && (
                      <div className='text-muted-foreground text-xs break-words'>
                        {described.detail}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <div
            className={cn(
              'flex flex-col gap-2 rounded-md p-3 text-sm',
              result.allowed ? 'bg-success/10' : 'bg-destructive/10'
            )}
          >
            <div
              className={cn(
                'font-medium',
                result.allowed ? 'text-success' : 'text-destructive'
              )}
            >
              {result.allowed
                ? t('This user can call {{model}}', { model: result.model })
                : t('Calls to {{model}} will fail', { model: result.model })}
            </div>
            {result.allowed && result.channels.length > 0 && (
              <div className='text-muted-foreground text-xs'>
                {result.channels
                  .map((channel) => `#${channel.id} ${channel.name}`)
                  .join(', ')}
              </div>
            )}
            {!result.allowed && result.groups_with_model.length > 0 && (
              <div className='text-muted-foreground text-xs'>
                {t(
                  'Groups this user may select that serve the model: {{groups}}',
                  {
                    groups: result.groups_with_model.join(', '),
                  }
                )}
              </div>
            )}
            {!result.allowed && result.groups_with_model.length === 0 && (
              <div className='text-muted-foreground text-xs'>
                {t(
                  'No group this user may select serves the model. Add a channel first.'
                )}
              </div>
            )}
            {token && suggestedGroup && suggestedGroup !== token.group && (
              <div>
                <Button
                  size='sm'
                  disabled={moveToken.isPending}
                  onClick={() => setMoveTarget(suggestedGroup)}
                >
                  {t('Move token {{name}} to group {{group}}', {
                    name: token.name,
                    group: suggestedGroup,
                  })}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={moveTarget !== null && !verificationActive}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        title={t('Change token group')}
        desc={t(
          'Move token {{name}} of {{username}} to group {{group}}? Requests with this token will be billed at that group ratio.',
          {
            name: token?.name ?? '',
            username: props.username,
            group: moveTarget ?? '',
          }
        )}
        confirmText={t('Change group')}
        isLoading={moveToken.isPending}
        handleConfirm={() => {
          if (moveTarget === null) return
          moveToken.mutate(moveTarget, {
            onSettled: () => setMoveTarget(null),
          })
        }}
      />
    </div>
  )
}

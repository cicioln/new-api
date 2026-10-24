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
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/components/error-state'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LoadingState } from '@/components/loading-state'
import { Card } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { handleServerError } from '@/lib/handle-server-error'
import { accountPasswordSchema } from '@/lib/password-policy'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { buildSetupPayload, getSetupStatus, submitSetup } from './api'
import { AdminStep } from './components/admin-step'
import { CompleteStep } from './components/complete-step'
import { DatabaseStep } from './components/database-step'
import { StepNavigation } from './components/step-navigation'
import { UsageModeStep } from './components/usage-mode-step'
import type { SetupFormValues, SetupStatus } from './types'

const STEPS = [
  { titleKey: 'Database check' },
  { titleKey: 'Administrator account' },
  { titleKey: 'Usage mode' },
  { titleKey: 'Review & initialize' },
]

const DEFAULT_FORM_VALUES: SetupFormValues = {
  username: '',
  password: '',
  confirmPassword: '',
  usageMode: 'external',
}

export function SetupWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { systemName, logo, loading: systemConfigLoading } = useSystemConfig()

  const [currentStep, setCurrentStep] = useState(0)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | undefined>()

  const form = useForm<SetupFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onBlur',
  })

  const watchedValues = form.watch()

  const {
    data: statusResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['setup-status'],
    queryFn: async () => requireServerSuccess(await getSetupStatus()),
    retry: false,
  })

  const mutation = useMutation({
    mutationKey: ['setup-submit'],
    mutationFn: submitSetup,
    onSuccess: async (response) => {
      if (response.success) {
        toast.success(t('System initialized successfully! Redirecting…'))
        await queryClient.invalidateQueries({ queryKey: ['setup-status'] })
        setTimeout(() => {
          navigate({ to: '/' })
        }, 1200)
      } else {
        handleServerError(
          response,
          t('Initialization failed, please try again.')
        )
      }
    },
    onError: (error) => {
      handleServerError(error, t('Failed to initialize system'))
    },
  })

  useEffect(() => {
    if (!statusResponse) return

    if (!statusResponse.success) {
      handleServerError(statusResponse, t('Failed to load setup status'))
      return
    }

    const status = statusResponse.data
    if (!status) return

    if (status.status) {
      navigate({ to: '/' })
      return
    }

    setSetupStatus(status)
    setCurrentStep(0)

    // Pre-fill usage mode if backend echoes it
    if (status.SelfUseModeEnabled) {
      form.setValue('usageMode', 'self', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    } else if (status.DemoSiteEnabled) {
      form.setValue('usageMode', 'demo', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    } else {
      form.setValue('usageMode', 'external', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusResponse, navigate, form])

  useEffect(() => {
    if (!setupStatus) return

    // Reset admin fields when backend reports they are already initialized
    if (setupStatus.root_init) {
      form.setValue('username', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      form.setValue('password', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      form.setValue('confirmPassword', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
    }
  }, [setupStatus, form])

  const currentStepComponent = useMemo(() => {
    if (currentStep === 0) {
      return <DatabaseStep status={setupStatus} />
    }
    if (currentStep === 1) {
      return (
        <AdminStep
          form={form}
          rootInitialized={Boolean(setupStatus?.root_init)}
        />
      )
    }
    if (currentStep === 2) {
      return <UsageModeStep form={form} />
    }
    return <CompleteStep status={setupStatus} values={watchedValues} />
  }, [currentStep, setupStatus, form, watchedValues])

  const validateAdminStep = () => {
    if (setupStatus?.root_init) return true

    const username = form.getValues('username')?.trim()
    const password = form.getValues('password')
    const confirmPassword = form.getValues('confirmPassword')

    if (!username) {
      form.setError('username', {
        type: 'manual',
        message: t('Please enter an administrator username'),
      })
      toast.error(t('Please enter an administrator username'))
      return false
    }

    if (!accountPasswordSchema.safeParse(password).success) {
      form.setError('password', {
        type: 'manual',
        message: t('Password must contain between 8 and 128 characters.'),
      })
      toast.error(t('Password must contain between 8 and 128 characters.'))
      return false
    }

    if (password !== confirmPassword) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: t('Passwords do not match'),
      })
      toast.error(t('Passwords do not match'))
      return false
    }

    return true
  }

  const validateUsageModeStep = () => {
    const usageMode = form.getValues('usageMode')
    if (!usageMode) {
      form.setError('usageMode', {
        type: 'manual',
        message: t('Select a usage mode to continue'),
      })
      toast.error(t('Select a usage mode to continue'))
      return false
    }
    return true
  }

  const handleNextStep = () => {
    if (currentStep === 1 && !validateAdminStep()) return
    if (currentStep === 2 && !validateUsageModeStep()) return

    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1))
  }

  const handlePreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  const handleSubmit = async () => {
    const adminValid = validateAdminStep()
    const usageValid = validateUsageModeStep()
    if (!adminValid || !usageValid) return

    const payload = buildSetupPayload(
      form.getValues(),
      Boolean(setupStatus?.root_init)
    )

    mutation.mutate(payload)
  }

  return (
    <div className='bg-background grid min-h-svh place-items-center px-4 py-8'>
      <Card className='w-full max-w-[640px] gap-0 overflow-hidden py-0'>
        <header className='flex items-center justify-between gap-3 border-b px-6 py-[18px]'>
          <div className='flex items-center gap-2.5'>
            {systemConfigLoading ? (
              <Skeleton className='size-7 rounded-md' />
            ) : (
              <img
                src={logo}
                alt={t('System logo')}
                className='size-7 rounded-md object-cover'
              />
            )}
            {systemConfigLoading ? (
              <Skeleton className='h-5 w-24' />
            ) : (
              <h1 className='text-[15px] font-semibold tracking-tight'>
                {systemName}
              </h1>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>
              {t('System setup wizard')}
            </span>
            <LanguageSwitcher />
          </div>
        </header>

        <ol className='grid grid-cols-4 gap-2 px-6 pt-[18px]'>
          {STEPS.map((step, index) => {
            const isActive = currentStep === index
            const isCompleted = currentStep > index
            return (
              <li
                key={step.titleKey}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'text-muted-foreground flex min-w-0 items-center gap-2 border-b-2 pb-3 text-[13px]',
                  isActive && 'border-foreground text-foreground font-medium'
                )}
              >
                <span
                  className={cn(
                    'bg-muted grid size-5 flex-none place-items-center rounded-full font-mono text-[11px]',
                    isActive && 'bg-foreground text-background',
                    isCompleted && 'bg-success text-white'
                  )}
                >
                  {index + 1}
                </span>
                <span className='hidden truncate sm:inline'>
                  {t(step.titleKey)}
                </span>
              </li>
            )
          })}
        </ol>

        <div className='min-h-[260px] p-6'>
          {isLoading && <LoadingState message={t('Loading setup status…')} />}
          {!isLoading && isError && (
            <ErrorState
              title={t('We could not load the setup status.')}
              onRetry={() => refetch()}
            />
          )}
          {!isLoading && !isError && (
            <Form {...form}>
              <form
                className='space-y-6'
                onSubmit={(event) => event.preventDefault()}
              >
                {currentStepComponent}
              </form>
            </Form>
          )}
        </div>

        {!isLoading && !isError && (
          <footer className='bg-background border-t px-6 py-3.5'>
            <StepNavigation
              currentStep={currentStep}
              totalSteps={STEPS.length}
              onBack={handlePreviousStep}
              onNext={handleNextStep}
              onSubmit={handleSubmit}
              isSubmitting={mutation.isPending}
            />
          </footer>
        )}
      </Card>
    </div>
  )
}

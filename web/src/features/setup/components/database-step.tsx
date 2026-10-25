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
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'

import type { SetupStatus } from '../types'

interface DatabaseStepProps {
  status?: SetupStatus
}

const DATABASE_META: Record<
  string,
  {
    label: string
    descriptionKey: string
    badgeKey: string
    variant: 'info' | 'success' | 'warning'
  }
> = {
  sqlite: {
    label: 'SQLite',
    descriptionKey:
      'Data directory: /data/one-api.db · Mount /data when deploying in containers, or data is lost on restart',
    badgeKey: 'Persist the data file',
    variant: 'warning',
  },
  mysql: {
    label: 'MySQL',
    descriptionKey:
      'MySQL is production ready. Ensure automated backups and a dedicated user with the minimal required privileges are configured.',
    badgeKey: 'MySQL detected',
    variant: 'success',
  },
  postgres: {
    label: 'PostgreSQL',
    descriptionKey:
      'PostgreSQL offers strong reliability guarantees. Double check your maintenance window and retention policies before going live.',
    badgeKey: 'PostgreSQL detected',
    variant: 'success',
  },
}

export function DatabaseStep(props: DatabaseStepProps) {
  const { t } = useTranslation()
  const type = props.status?.database_type
  const meta = type
    ? (DATABASE_META[type.toLowerCase()] ?? {
        label: type,
        descriptionKey: 'Custom database driver detected.',
        badgeKey: 'Detected database',
        variant: 'info' as const,
      })
    : null
  const electronApi =
    typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>)?.electron as
          | Record<string, unknown>
          | undefined)
      : undefined
  const isElectron = Boolean(electronApi?.isElectron)
  const electronDataDir = electronApi?.dataDir as string | undefined

  return (
    <section>
      <h2 className='text-lg font-semibold'>{t('Detected database')}</h2>
      <p className='text-muted-foreground mt-0.5 mb-3.5 text-[12.5px]'>
        {t(
          'The database is determined by the SQL_DSN environment variable; the wizard only confirms it.'
        )}
      </p>
      <div className='divide-y'>
        <div data-testid='setup-database-row' className='pb-3.5'>
          <p className='flex flex-wrap items-center gap-2 text-[13.5px] font-medium'>
            {meta?.label ?? t('Unknown')}
            {meta && (
              <StatusBadge
                label={t(meta.badgeKey)}
                variant={meta.variant}
                copyable={false}
              />
            )}
          </p>
          <p className='text-muted-foreground mt-0.5 text-[12.5px]'>
            {t(
              meta?.descriptionKey ??
                'The setup wizard will use this database during initialization.'
            )}
          </p>
          {isElectron && electronDataDir && (
            <p className='text-muted-foreground mt-1 font-mono text-xs'>
              {t('Data directory:')} {electronDataDir}
            </p>
          )}
          {isElectron && !electronDataDir && (
            <p className='text-muted-foreground mt-1 text-xs'>
              {t(
                'Data is stored locally on this device. Use system backups to keep a safe copy.'
              )}
            </p>
          )}
        </div>
        <div className='py-3.5'>
          <p className='text-[13.5px] font-medium'>{t('Supported')}</p>
          <p className='text-muted-foreground mt-0.5 text-[12.5px]'>
            {t(
              'MySQL ≥ 5.7.8 · PostgreSQL ≥ 9.6. Set SQL_DSN and restart to switch.'
            )}
          </p>
        </div>
      </div>
    </section>
  )
}

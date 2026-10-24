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
import { ArrowLeftRight, ChartColumn, Coins, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'balance',
      icon: ArrowLeftRight,
      title: t('Multi-channel load balancing'),
      desc: t(
        'Configure several channels per model and route by weight and priority to avoid a single upstream rate limit.'
      ),
    },
    {
      id: 'failover',
      icon: ShieldCheck,
      title: t('Automatic failover'),
      desc: t(
        'Errors or timeouts retry the next channel; channels that keep failing are disabled temporarily.'
      ),
    },
    {
      id: 'billing',
      icon: Coins,
      title: t('Group billing'),
      desc: t(
        'Set ratios per user group, bill per token or per request, and deduct balance and quota in real time.'
      ),
    },
    {
      id: 'usage',
      icon: ChartColumn,
      title: t('Usage analytics'),
      desc: t(
        'See calls, spend and latency by key, model and group, with a log entry for every request.'
      ),
    },
  ]

  return (
    <section className='pt-24'>
      <h2 className='mb-2 text-[30px] font-semibold tracking-tight'>
        {t('Everything a gateway should do')}
      </h2>
      <p className='text-subtle-foreground mb-7 text-[14.5px]'>
        {t('Channels, billing and monitoring in one console.')}
      </p>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {features.map((feature) => (
          <div
            key={feature.id}
            data-card-hover='false'
            className='bg-card rounded-lg border p-6'
          >
            <div className='bg-accent text-primary mb-[18px] grid size-[38px] place-items-center rounded-[10px]'>
              <feature.icon className='size-5' strokeWidth={1.8} aria-hidden />
            </div>
            <h3 className='mb-2 text-[15.5px] font-semibold'>
              {feature.title}
            </h3>
            <p className='text-subtle-foreground text-[13.5px] leading-relaxed'>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

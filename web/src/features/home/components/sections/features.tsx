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
import type { SVGProps } from 'react'
import { useTranslation } from 'react-i18next'

type IconProps = SVGProps<SVGSVGElement>

function Icon(props: IconProps & { d: string; circle?: boolean }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.8}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={props.className}
      aria-hidden
    >
      {props.circle && <circle cx='12' cy='12' r='9' />}
      <path d={props.d} />
    </svg>
  )
}

const SwapIcon = (props: IconProps) => (
  <Icon {...props} d='M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7' />
)
const ShieldIcon = (props: IconProps) => (
  <Icon {...props} d='M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z' />
)
const CoinIcon = (props: IconProps) => (
  <Icon
    {...props}
    circle
    d='M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2'
  />
)
const ChartIcon = (props: IconProps) => (
  <Icon {...props} d='M4 20V10M10 20V4M16 20v-7M22 20H2' />
)

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'balance',
      icon: SwapIcon,
      title: t('Multi-channel load balancing'),
      desc: t(
        'Configure several channels per model and route by weight and priority to avoid a single upstream rate limit.'
      ),
    },
    {
      id: 'failover',
      icon: ShieldIcon,
      title: t('Automatic failover'),
      desc: t(
        'Errors or timeouts retry the next channel; channels that keep failing are disabled temporarily.'
      ),
    },
    {
      id: 'billing',
      icon: CoinIcon,
      title: t('Group billing'),
      desc: t(
        'Set ratios per user group, bill per token or per request, and deduct balance and quota in real time.'
      ),
    },
    {
      id: 'usage',
      icon: ChartIcon,
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
      <div className='grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1'>
        {features.map((feature) => (
          <div
            key={feature.id}
            data-card-hover='false'
            className='bg-card rounded-lg border p-6'
          >
            <div className='bg-accent text-primary mb-[18px] grid size-[38px] place-items-center rounded-[10px]'>
              <feature.icon className='size-5' />
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

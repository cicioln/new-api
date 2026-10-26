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
import { AnimatedOutlet } from '@/components/page-transition'
import { SkipToMain } from '@/components/skip-to-main'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { getCookie } from '@/lib/cookies'

import { AppSidebar } from './app-sidebar'
import { PublicHeader } from './public-header'
import { CONSOLE_HREF } from './site-nav'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout(props: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <LayoutProvider>
      <SearchProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          className='h-svh min-h-0 flex-col overflow-hidden'
        >
          <SkipToMain />
          {/* The console shares the site header; the sidebar sits below it. */}
          <PublicHeader
            activeNavHref={CONSOLE_HREF}
            leftContent={
              <SidebarTrigger
                variant='ghost'
                className='bg-card [&_svg]:text-muted-foreground -me-4 size-[34px] shrink-0 rounded-lg border md:hidden'
              />
            }
            className='shrink-0'
          />
          <div className='flex min-h-0 flex-1'>
            <AppSidebar />
            <SidebarInset className='@container/content min-h-0 overflow-hidden'>
              <div className='flex min-h-0 flex-1 flex-col'>
                {props.children ?? <AnimatedOutlet />}
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </SearchProvider>
    </LayoutProvider>
  )
}

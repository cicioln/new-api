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
import { Skeleton } from '@/components/ui/skeleton'

/** Six placeholder model cards shown while /api/pricing loads. */
export function LoadingSkeleton() {
  return (
    <div
      aria-busy='true'
      className='grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5'
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className='bg-card flex flex-col gap-3 rounded-xl border p-[18px]'
        >
          <div className='flex items-center gap-3'>
            <Skeleton className='size-[34px] rounded-[9px]' />
            <div className='flex-1'>
              <Skeleton className='h-3 w-3/5' />
              <Skeleton className='mt-1.5 h-2.5 w-[30%]' />
            </div>
          </div>
          <Skeleton className='h-[22px] w-4/5' />
          <Skeleton className='h-11' />
          <Skeleton className='h-[30px]' />
        </div>
      ))}
    </div>
  )
}

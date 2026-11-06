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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import type { StudioImageJob } from '../api'
import {
  getSaveLocally,
  loadSavedImages,
  putSavedImage,
  type SavedImage,
} from './image-history'

export const SAVED_IMAGES_KEY = ['studio-saved-images']

/** A job whose images now exist only in this browser. */
export type LocalJob = {
  jobId: string
  prompt: string
  model: string
  size?: string
  createdAt: number
  images: string[]
}

// Object URLs are created once per saved image and live as long as the page.
const objectUrls = new Map<string, string>()
const copying = new Set<string>()

function objectUrl(image: SavedImage): string {
  let url = objectUrls.get(image.id)
  if (!url) {
    url = URL.createObjectURL(image.blob)
    objectUrls.set(image.id, url)
  }
  return url
}

export function useSavedImages() {
  return useQuery({
    queryKey: SAVED_IMAGES_KEY,
    queryFn: loadSavedImages,
    staleTime: Infinity,
  })
}

/**
 * Copies finished server images into this browser. Run it from one always
 * mounted component.
 */
export function useCopyImagesLocally(jobs: StudioImageJob[] | undefined) {
  const queryClient = useQueryClient()
  const saved = useSavedImages()
  useEffect(() => {
    if (!jobs || !saved.data || !getSaveLocally()) return
    const have = new Set(saved.data.map((image) => image.id))
    const pending = jobs.flatMap((job) =>
      job.status === 'success'
        ? job.images
            .map((src, index) => ({ job, src, id: `${job.id}#${index}` }))
            // External URLs may not allow a cross-origin read.
            .filter((item) => item.src.startsWith('/') && !have.has(item.id))
            .filter((item) => !copying.has(item.id))
        : []
    )
    if (pending.length === 0) return
    let stored = false
    void Promise.all(
      pending.map(async ({ job, src, id }) => {
        copying.add(id)
        try {
          const response = await fetch(src)
          if (!response.ok) return
          const blob = await response.blob()
          stored =
            (await putSavedImage({
              id,
              jobId: job.id,
              blob,
              prompt: job.prompt,
              model: job.model,
              size: job.size,
              createdAt: (job.finished_at ?? job.created_at) * 1000,
            })) || stored
        } catch {
          // Try again on the next list refresh.
        } finally {
          copying.delete(id)
        }
      })
    ).then(() => {
      if (stored)
        void queryClient.invalidateQueries({ queryKey: SAVED_IMAGES_KEY })
    })
  }, [jobs, saved.data, queryClient])
}

/**
 * Jobs kept in this browser that the server no longer lists, newest first.
 * Returns [] until the server list has loaded.
 */
export function useLocalOnlyJobs(
  jobs: StudioImageJob[] | undefined
): LocalJob[] {
  const saved = useSavedImages()
  return useMemo(() => {
    if (!jobs || !saved.data) return []
    const onServer = new Set(jobs.map((job) => job.id))
    const byJob = new Map<string, LocalJob>()
    // Ids end in "#<index>", so sorting by id keeps each job's image order.
    const ordered = [...saved.data].sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const image of ordered) {
      if (onServer.has(image.jobId)) continue
      let job = byJob.get(image.jobId)
      if (!job) {
        job = {
          jobId: image.jobId,
          prompt: image.prompt,
          model: image.model,
          size: image.size,
          createdAt: image.createdAt,
          images: [],
        }
        byJob.set(image.jobId, job)
      }
      job.images.push(objectUrl(image))
    }
    return [...byJob.values()].sort((a, b) => b.createdAt - a.createdAt)
  }, [jobs, saved.data])
}

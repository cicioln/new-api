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

// Generated images are not stored on the server. The studio keeps the most
// recent ones in this browser's IndexedDB; localStorage is too small for
// base64 images.

export const MAX_STORED_IMAGES = 50

export type StoredImage = {
  id: string
  src: string
  prompt: string
  model: string
  createdAt: number
}

const DB_NAME = 'new-api-studio'
const STORE = 'images'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request ? request.result : undefined)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Stored images, newest first. Resolves to [] when storage is unavailable. */
export async function loadImages(): Promise<StoredImage[]> {
  try {
    const all = await withStore<StoredImage[]>('readonly', (store) =>
      store.getAll()
    )
    return (all ?? []).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

/** Adds images and drops the oldest beyond MAX_STORED_IMAGES. */
export async function saveImages(
  images: StoredImage[],
  existing: StoredImage[]
): Promise<void> {
  const overflow = [...images, ...existing].slice(MAX_STORED_IMAGES)
  try {
    await withStore('readwrite', (store) => {
      for (const image of images) store.put(image)
      for (const image of overflow) store.delete(image.id)
    })
  } catch {
    // The page keeps working without persistence.
  }
}

export async function deleteImage(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      store.delete(id)
    })
  } catch {
    // ignore
  }
}

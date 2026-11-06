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

// Studio images kept in this browser's IndexedDB.
//
// "images" holds images generated before the studio stored them on the
// server; nothing new is written there. "saved" holds copies of server
// images, so they stay viewable here after the server deletes them.

export type StoredImage = {
  id: string
  src: string
  prompt: string
  model: string
  createdAt: number
}

export type SavedImage = {
  /** `${jobId}#${index}` */
  id: string
  jobId: string
  blob: Blob
  prompt: string
  model: string
  size?: string
  createdAt: number
}

const DB_NAME = 'new-api-studio'
const LEGACY = 'images'
const SAVED = 'saved'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(LEGACY)) {
        db.createObjectStore(LEGACY, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(SAVED)) {
        db.createObjectStore(SAVED, { keyPath: 'id' }).createIndex(
          'jobId',
          'jobId'
        )
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(name, mode)
      const request = run(tx.objectStore(name))
      tx.oncomplete = () => resolve(request ? request.result : undefined)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Legacy images, newest first. Resolves to [] when storage is unavailable. */
export async function loadImages(): Promise<StoredImage[]> {
  try {
    const all = await withStore<StoredImage[]>(LEGACY, 'readonly', (store) =>
      store.getAll()
    )
    return (all ?? []).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function deleteImage(id: string): Promise<void> {
  try {
    await withStore(LEGACY, 'readwrite', (store) => {
      store.delete(id)
    })
  } catch {
    // ignore
  }
}

/** Local copies of server images, newest first. */
export async function loadSavedImages(): Promise<SavedImage[]> {
  try {
    const all = await withStore<SavedImage[]>(SAVED, 'readonly', (store) =>
      store.getAll()
    )
    return (all ?? []).sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

/** Saves a copy; returns false when the browser refused it (e.g. quota). */
export async function putSavedImage(image: SavedImage): Promise<boolean> {
  try {
    await withStore(SAVED, 'readwrite', (store) => {
      store.put(image)
    })
    return true
  } catch {
    return false
  }
}

export async function deleteSavedJob(jobId: string): Promise<void> {
  try {
    const db = await openDb()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SAVED, 'readwrite')
        const store = tx.objectStore(SAVED)
        const keys = store.index('jobId').getAllKeys(jobId)
        keys.onsuccess = () => keys.result.forEach((key) => store.delete(key))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  } catch {
    // ignore
  }
}

const SAVE_LOCALLY_KEY = 'studio-save-images-locally'

/** Whether finished images are copied into this browser. Defaults to on. */
export function getSaveLocally(): boolean {
  try {
    return localStorage.getItem(SAVE_LOCALLY_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSaveLocally(value: boolean) {
  try {
    localStorage.setItem(SAVE_LOCALLY_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

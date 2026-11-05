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

// Images generated before the studio stored them on the server were kept in
// this browser's IndexedDB. They are still shown and can be deleted; new
// images are never written here.

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

export async function deleteImage(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      store.delete(id)
    })
  } catch {
    // ignore
  }
}

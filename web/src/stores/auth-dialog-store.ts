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

import { create } from 'zustand'

export type AuthDialogMode = 'sign-in' | 'sign-up'

type AuthDialogState = {
  mode: AuthDialogMode | null
  redirect?: string
  /** Path the dialog was opened on; leaving it closes the dialog. */
  openedAt?: string
  open: (mode: AuthDialogMode, redirect?: string) => void
  close: () => void
}

/** Sign-in / sign-up dialog that any page can open in place. */
export const useAuthDialogStore = create<AuthDialogState>()((set) => ({
  mode: null,
  redirect: undefined,
  open: (mode, redirect) =>
    set({ mode, redirect, openedAt: window.location.pathname }),
  close: () => set({ mode: null, redirect: undefined, openedAt: undefined }),
}))

/** Opens the auth dialog and returns to `redirect` (or the current page). */
export function openAuthDialog(mode: AuthDialogMode, redirect?: string) {
  const current = `${window.location.pathname}${window.location.search}`
  useAuthDialogStore.getState().open(mode, redirect ?? current)
}

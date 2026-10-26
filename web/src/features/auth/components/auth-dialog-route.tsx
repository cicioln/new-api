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

import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { Home } from '@/features/home'
import {
  openAuthDialog,
  useAuthDialogStore,
  type AuthDialogMode,
} from '@/stores/auth-dialog-store'
import { useAuthStore } from '@/stores/auth-store'

/**
 * /sign-in and /sign-up show the home page with the auth dialog open, so
 * old links, redirects and invite links keep working without a full page.
 * Dismissing the dialog leaves the URL for the home page.
 */
export function AuthDialogRoute(props: {
  mode: AuthDialogMode
  redirect?: string
}) {
  const navigate = useNavigate()

  useEffect(() => {
    openAuthDialog(props.mode, props.redirect ?? '/dashboard')
    return useAuthDialogStore.subscribe((state, previous) => {
      // A sign-in closes the dialog too; its own redirect handles navigation.
      if (useAuthStore.getState().auth.user) return
      if (state.mode === null && previous.mode !== null) {
        const path = window.location.pathname
        if (path === '/sign-in' || path === '/sign-up') {
          void navigate({ to: '/', replace: true })
        }
      }
    })
  }, [props.mode, props.redirect, navigate])

  return <Home />
}

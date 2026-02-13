import { create } from 'zustand'

type AdminAuthState = {
  token: string | null
  setToken: (token: string | null) => void
  logout: () => void
}

const STORAGE_KEY = 'admin_token'

export const useAdminAuth = create<AdminAuthState>((set) => ({
  token: typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    set({ token })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ token: null })
  },
}))


import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSidebarStore = create(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    { name: 'sidebar-storage' }
  )
)

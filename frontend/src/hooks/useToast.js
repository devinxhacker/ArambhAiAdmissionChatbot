/**
 * Global toast store using Zustand.
 * Allows any component to trigger toasts that are rendered by <Toaster />.
 */
import { create } from 'zustand'

let toastCount = 0

const useToastStore = create((set) => ({
  toasts: [],

  addToast: ({ title, description, variant = 'default', duration = 4000 }) => {
    const id = ++toastCount
    set((state) => ({
      toasts: [...state.toasts, { id, title, description, variant, open: true }],
    }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)
    return id
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/**
 * useToast — returns a `toast` function and the current `toasts` list.
 * Compatible with both the Toaster component and any page/component.
 */
export function useToast() {
  const { toasts, addToast, dismissToast } = useToastStore()
  return {
    toasts,
    toast: addToast,
    dismiss: dismissToast,
  }
}

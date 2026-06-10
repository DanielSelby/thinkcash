'use client'

import { useEffect, useState } from 'react'
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from './toast'

type ToastType = {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

const listeners: Array<(toasts: ToastType[]) => void> = []
let toastState: ToastType[] = []

function dispatch(toasts: ToastType[]) {
  toastState = toasts
  listeners.forEach(l => l(toastState))
}

export function toast({
  title,
  description,
  variant = 'default',
}: Omit<ToastType, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  dispatch([...toastState, { id, title, description, variant }])
  setTimeout(() => {
    dispatch(toastState.filter(t => t.id !== id))
  }, 4000)
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastType[]>([])

  useEffect(() => {
    listeners.push(setToasts)
    return () => {
      const idx = listeners.indexOf(setToasts)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant }) => (
        <Toast key={id} variant={variant}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

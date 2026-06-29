import { create } from 'zustand';

interface Toast {
  id: number;
  mensaje: string;
  imagen?: string;
}

interface ToastState {
  toasts: Toast[];
  agregar: (mensaje: string, imagen?: string) => void;
  quitar: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  agregar: (mensaje, imagen) => {
    const id = ++nextId;
    set(s => ({ toasts: [...s.toasts, { id, mensaje, imagen }] }));
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  quitar: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

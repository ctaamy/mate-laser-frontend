import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: string;
}

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        set({
          usuario: data.usuario,
          token: data.token,
          isAuthenticated: true,
        });
      },

      register: async (registerData) => {
        const { data } = await api.post('/auth/register', registerData);
        localStorage.setItem('token', data.token);
        set({
          usuario: data.usuario,
          token: data.token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          usuario: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage-v2',
    }
  )
);


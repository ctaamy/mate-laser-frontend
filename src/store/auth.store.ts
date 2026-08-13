import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: string;
  email_verificado?: boolean;
}

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginConToken: (token: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  actualizarUsuario: (usuario: Partial<Usuario>) => void;
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
        localStorage.setItem('refreshToken', data.refreshToken);
        set({
          usuario: data.usuario,
          token: data.token,
          isAuthenticated: true,
        });
      },

      register: async (registerData) => {
        const { data } = await api.post('/auth/register', registerData);
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({
          usuario: data.usuario,
          token: data.token,
          isAuthenticated: true,
        });
      },

      // Login con Google: el backend ya emitió los tokens (ver /auth/google/callback),
      // acá solo los guardamos y traemos el perfil del usuario para completar el estado.
      loginConToken: async (token, refreshToken) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        const { data: usuario } = await api.get('/usuarios/perfil');
        set({
          usuario,
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        set({
          usuario: null,
          token: null,
          isAuthenticated: false,
        });
      },

      // Merge parcial tras editar perfil (PUT /usuarios/perfil) sin recargar la página.
      actualizarUsuario: (datos) => {
        set((state) => ({
          usuario: state.usuario ? { ...state.usuario, ...datos } : state.usuario,
        }));
      },
    }),
    {
      name: 'auth-storage-v2',
    }
  )
);


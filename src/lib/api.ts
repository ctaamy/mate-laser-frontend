import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      // En rutas de checkout/pago/confirmacion no redirigir al login (guests válidos)
      const esRutaPublica = ['/pago/', '/checkout', '/confirmacion/'].some(r => path.includes(r));
      if (!esRutaPublica) {
        localStorage.removeItem('token');
        useAuthStore.getState().logout();
        if (path !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
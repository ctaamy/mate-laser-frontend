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

// El access token dura 15min. Ante un 401 intentamos refrescarlo una sola vez
// con el refresh token (rotación en el backend, ver AuthService.refresh) antes
// de resignarnos a un logout. Si mientras tanto salen varias requests en 401
// a la vez, todas esperan el mismo refresh en curso en vez de disparar uno cada una.
let refrescando: Promise<string> | null = null;

function hacerLogoutYRedirigir() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  useAuthStore.getState().logout();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const path = window.location.pathname;
    // En rutas de checkout/pago/confirmacion no redirigir al login (guests válidos).
    // /verificar-email y /resetear-password se abren desde el link del correo,
    // normalmente sin sesión: un 401 ahí es "token del link inválido/vencido",
    // no una sesión caída, y lo maneja la propia página.
    const esRutaPublica = ['/pago/', '/checkout', '/confirmacion/', '/verificar-email', '/resetear-password', '/olvide-password', '/confirmar-newsletter', '/baja-newsletter'].some(r => path.includes(r));

    if (error.response?.status === 401 && !esRutaPublica && !original?._reintentoRefresh) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        hacerLogoutYRedirigir();
        return Promise.reject(error);
      }

      original._reintentoRefresh = true;

      try {
        if (!refrescando) {
          refrescando = axios
            .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
            .then(({ data }) => {
              localStorage.setItem('token', data.token);
              localStorage.setItem('refreshToken', data.refreshToken);
              return data.token as string;
            })
            .finally(() => {
              refrescando = null;
            });
        }

        const nuevoToken = await refrescando;
        original.headers.Authorization = `Bearer ${nuevoToken}`;
        return api(original);
      } catch (refreshError) {
        hacerLogoutYRedirigir();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

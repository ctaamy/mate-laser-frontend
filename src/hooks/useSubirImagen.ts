import { useState } from 'react';
import api from '../lib/api';

const MAX_BYTES = 5 * 1024 * 1024;

export function useSubirImagen<T = { url: string }>(
  endpoint: string,
  onSuccess: (data: T) => void,
  mensajeArchivoGrande = 'El archivo supera 5 MB.',
  mensajeErrorSubida = 'Error al subir la imagen. Intentá de nuevo.',
) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const subir = async (file: File, validar?: () => string | null) => {
    const errorValidacion = validar?.();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(mensajeArchivoGrande);
      return;
    }
    setError('');
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess(res.data as T);
    } catch {
      setError(mensajeErrorSubida);
    } finally {
      setSubiendo(false);
    }
  };

  return { subir, subiendo, error, setError };
}

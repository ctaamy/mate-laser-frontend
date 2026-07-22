import { useState } from 'react';
import api from '../lib/api';

const MAX_BYTES = 5 * 1024 * 1024;
// Tope de dimensión + calidad para re-codificar antes de subir. 1920px ya
// cubre el ancho máximo real de cualquier bloque del sitio (max-w-6xl =
// 1152px, hero full-bleed a lo sumo el viewport) con margen para pantallas
// retina — subir más resolución que eso solo infla el peso sin mejora
// visible. Un solo lugar (este hook lo usan todos los uploaders: hero,
// categorías, productos, banners) — si hace falta ajustar la compresión
// mañana, se cambia acá una sola vez.
const MAX_DIMENSION_PX = 1920;
const CALIDAD_WEBP = 0.85;

// Bugfix: las imágenes se subían tal cual las entregaba el input de
// archivo, sin ningún resize/recompresión — un hero de cámara de celular
// pesaba varios MB, tardaba varios segundos en cargar y durante ese tiempo
// el bloque se veía como un rectángulo de color plano sin ninguna imagen
// (fácil de confundir con "el efecto no se aplicó"). Se re-codifica a WebP
// y se limita la dimensión máxima ANTES de subir, sin tocar el backend.
// Los GIF se dejan intactos para no romper la animación (un canvas los
// aplana a un solo frame).
async function comprimirImagen(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
      const escala = MAX_DIMENSION_PX / Math.max(width, height);
      width = Math.round(width * escala);
      height = Math.round(height * escala);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', CALIDAD_WEBP));
    // Si por algún motivo el resultado no pesa menos (ej. imagen ya chica
    // y simple), se sube el archivo original — nunca empeorar a propósito.
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    // Si createImageBitmap/canvas falla por lo que sea, se sube el original
    // en vez de bloquear la subida.
    return file;
  }
}

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
    setError('');
    setSubiendo(true);
    try {
      const archivo = await comprimirImagen(file);
      if (archivo.size > MAX_BYTES) {
        setError(mensajeArchivoGrande);
        return;
      }
      const fd = new FormData();
      fd.append('file', archivo);
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

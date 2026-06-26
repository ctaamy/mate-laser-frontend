import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Star, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import type { ImagenProducto } from '../../types';

interface ImageUploaderProps {
  productoId: string;
  imagenes: ImagenProducto[];
  onUpdate: () => void; // refresca la lista desde el padre
  maxImagenes?: number;
}

export default function ImageUploader({
  productoId,
  imagenes,
  onUpdate,
  maxImagenes = 4,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const subir = async (file: File) => {
    if (imagenes.length >= maxImagenes) {
      setError(`Máximo ${maxImagenes} imágenes por producto.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo supera 5 MB.');
      return;
    }
    setError('');
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/imagenes/producto/${productoId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdate();
    } catch {
      setError('Error al subir la imagen. Intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async (id: string) => {
    await api.delete(`/imagenes/${id}`);
    onUpdate();
  };

  const marcarPrincipal = async (id: string) => {
    await api.put(`/imagenes/${id}`, { es_principal: true });
    onUpdate();
  };

  // Drag & drop sobre la zona
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) subir(file);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Grid de imágenes cargadas */}
      <div className="grid grid-cols-4 gap-2">
        <AnimatePresence>
          {imagenes.map((img) => (
            <motion.div
              key={img.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="relative group aspect-square rounded-lg overflow-hidden border-2 border-transparent"
              style={{ borderColor: img.es_principal ? '#1D9E75' : 'transparent' }}
            >
              <img
                src={img.url}
                alt={img.alt_texto || 'imagen'}
                className="w-full h-full object-cover"
              />

              {/* Overlay de acciones — aparece al hover */}
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center gap-1"
              >
                {!img.es_principal && (
                  <button
                    onClick={() => marcarPrincipal(img.id)}
                    title="Marcar como principal"
                    className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center hover:bg-yellow-300"
                  >
                    <Star size={11} className="text-yellow-900" />
                  </button>
                )}
                <button
                  onClick={() => eliminar(img.id)}
                  title="Eliminar imagen"
                  className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400"
                >
                  <X size={11} className="text-white" />
                </button>
              </motion.div>

              {/* Badge "Principal" */}
              {img.es_principal && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-[#1D9E75] text-white rounded px-1.5 py-0.5 font-medium">
                  Principal
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Zona de subida — visible si hay espacio disponible */}
        {imagenes.length < maxImagenes && (
          <motion.div
            whileHover={{ borderColor: '#1D9E75', backgroundColor: '#f0fdf9' }}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer transition-colors gap-1"
          >
            {subiendo ? (
              <Loader2 size={18} className="text-[#1D9E75] animate-spin" />
            ) : (
              <>
                <Upload size={16} className="text-gray-400" />
                <span className="text-[10px] text-gray-400 text-center leading-tight px-1">
                  Subir<br />imagen
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }}
            />
          </motion.div>
        )}
      </div>

      {/* Conteo y error */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          {imagenes.length}/{maxImagenes} imágenes · La principal aparece primero
        </span>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}

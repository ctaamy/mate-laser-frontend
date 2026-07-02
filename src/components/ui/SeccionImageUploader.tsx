import { useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, Loader2, X } from 'lucide-react';
import { useSubirImagen } from '../../hooks/useSubirImagen';

interface SeccionImageUploaderProps {
  value: string;           // URL actual guardada en datos.imagen_url
  onChange: (url: string) => void;
  label?: string;
}

export default function SeccionImageUploader({ value, onChange, label = 'Imagen' }: SeccionImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { subir, subiendo, error } = useSubirImagen(
    '/configuracion/imagen',
    (data) => onChange(data.url),
    'Máximo 5 MB',
    'Error al subir. Intentá de nuevo.',
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500">{label}</label>

      {/* Preview si hay URL */}
      {value && (
        <div className="relative w-full h-28 rounded-lg overflow-hidden border border-gray-200 group">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          {/* Botón para quitar la imagen */}
          <button
            onClick={() => onChange('')}
            className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} className="text-white" />
          </button>
        </div>
      )}

      {/* Zona de subida */}
      <motion.div
        whileHover={{ borderColor: '#1D9E75', backgroundColor: '#f0fdf9' }}
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) subir(f); }}
        onDragOver={e => e.preventDefault()}
        className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
      >
        {subiendo ? (
          <Loader2 size={14} className="text-[#1D9E75] animate-spin flex-shrink-0" />
        ) : (
          <Upload size={14} className="text-gray-400 flex-shrink-0" />
        )}
        <span className="text-xs text-gray-400">
          {subiendo ? 'Subiendo...' : value ? 'Reemplazar imagen' : 'Subir imagen (o pegar URL abajo)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ''; }}
        />
      </motion.div>

      {/* Fallback: input de URL manual */}
      <input
        className="border border-gray-200 rounded-lg px-3 py-2 text-xs w-full focus:outline-none focus:border-[#1D9E75] text-gray-500"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="https://... (URL externa)"
      />

      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

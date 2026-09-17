import { useRef, useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Upload, X, GripVertical, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useSubirImagen } from '../../hooks/useSubirImagen';
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
  const { subir: subirArchivo, subiendo, error, setError } = useSubirImagen(
    `/imagenes/producto/${productoId}`,
    () => onUpdate(),
  );

  // Estado local para que el drag se sienta instantáneo (no esperar el
  // roundtrip PUT + refetch para mover la miniatura). Se resincroniza cuando
  // cambian las imágenes reales que llegan del padre — ajustado durante el
  // render (patrón de React para "derivar estado de una prop"), no en un
  // efecto, para no disparar un render en cascada.
  const [prevImagenes, setPrevImagenes] = useState(imagenes);
  const [items, setItems] = useState(imagenes);
  if (imagenes !== prevImagenes) {
    setPrevImagenes(imagenes);
    setItems(imagenes);
  }
  // Leído desde onDragEnd: se actualiza a mano en cada manejador de evento
  // que toca `items` (nunca durante el render, React no lo permite) — así
  // onDragEnd no depende de que ya haya corrido un re-render con el último
  // onReorder antes de que se suelte el drag.
  const itemsRef = useRef(items);

  const subir = (file: File) =>
    subirArchivo(file, () =>
      imagenes.length >= maxImagenes ? `Máximo ${maxImagenes} imágenes por producto.` : null,
    );

  const eliminar = async (id: string) => {
    await api.delete(`/imagenes/${id}`);
    onUpdate();
  };

  // onReorder dispara una vez por cada cruce durante el drag (no solo al
  // soltar) — acá solo actualizamos el estado local optimista. `orden` y
  // `es_principal` (posición 0 = principal, fusionados desde el backend) se
  // recalculan al vuelo para que el badge de "Principal" y el número no
  // parpadeen con el valor viejo hasta que confirme el server.
  const onReorder = (nuevoOrden: ImagenProducto[]) => {
    const conFlags = nuevoOrden.map((img, i) => ({ ...img, orden: i, es_principal: i === 0 }));
    itemsRef.current = conFlags;
    setItems(conFlags);
  };

  // Se persiste una sola vez, al soltar (onDragEnd de cada Item) — no en
  // cada onReorder, que puede disparar varias veces en un mismo gesto.
  const persistirOrden = async () => {
    const orden = itemsRef.current;
    try {
      await api.put(`/imagenes/producto/${productoId}/orden`, { ids: orden.map(i => i.id) });
      onUpdate();
    } catch {
      setError('No se pudo guardar el nuevo orden. Probá de nuevo.');
      itemsRef.current = imagenes;
      setItems(imagenes); // rollback al orden confirmado por el server
    }
  };

  // Drag & drop sobre la zona (subir archivo — no confundir con el reorder)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) subir(file);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Grid de imágenes cargadas. OJO: Reorder.Group con axis="x" compara
          posiciones solo en ese eje — funciona bien porque con maxImagenes=4
          y grid-cols-4 nunca hay wrap (siempre 1 sola fila). Si el día de
          mañana se sube maxImagenes sin cambiar el layout a algo que no
          wrappee, arrastrar entre filas va a dar swaps sin sentido visual. */}
      <div className="grid grid-cols-4 gap-2">
        <Reorder.Group as="div" axis="x" values={items} onReorder={onReorder} className="contents">
          <AnimatePresence>
            {items.map((img) => (
              <ImagenReordenable
                key={img.id}
                img={img}
                onDragEnd={persistirOrden}
                onEliminar={() => eliminar(img.id)}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {/* Zona de subida — visible si hay espacio disponible. Queda afuera
            del Reorder.Group: no es un ítem reordenable. */}
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
        <span className="text-[10px] text-gray-400">{imagenes.length}/{maxImagenes} imágenes</span>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}

interface ImagenReordenableProps {
  img: ImagenProducto;
  onDragEnd: () => void;
  onEliminar: () => void;
}

function ImagenReordenable({ img, onDragEnd, onEliminar }: ImagenReordenableProps) {
  const controls = useDragControls();
  const esPrincipal = img.orden === 0; // fusionado con el backend: posición 0 = principal

  return (
    <Reorder.Item
      value={img}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="relative aspect-square rounded-lg overflow-hidden border-2 bg-white"
      style={{ borderColor: esPrincipal ? '#1D9E75' : 'transparent' }}
    >
      <img
        src={img.url}
        alt={img.alt_texto || 'imagen'}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Agarre — único disparador del drag (dragListener=false en el Item),
          así no compite con el click de eliminar. Siempre visible: en touch
          no existe hover para revelarlo. */}
      <div
        onPointerDown={(e) => controls.start(e)}
        title="Arrastrar para reordenar"
        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={13} className="text-white" />
      </div>

      {/* Posición — siempre visible, para leer sin ambigüedad el resultado del drag */}
      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 text-white text-[10px] font-semibold flex items-center justify-center">
        {img.orden + 1}
      </span>

      {/* Eliminar — siempre visible (antes solo con hover, inalcanzable en touch) */}
      <button
        onClick={onEliminar}
        title="Eliminar imagen"
        className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-500"
      >
        <X size={14} className="text-white" />
      </button>

      {esPrincipal && (
        <span className="absolute bottom-1 left-1 text-[9px] bg-[#1D9E75] text-white rounded px-1.5 py-0.5 font-medium">
          Principal
        </span>
      )}
    </Reorder.Item>
  );
}

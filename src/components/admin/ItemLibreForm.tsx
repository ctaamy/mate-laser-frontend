import { useState } from 'react';
import AdminButton from './ui/AdminButton';
import { AdminInput, AdminLabel } from './ui/AdminInput';

interface Props {
  /** Prefijo para los data-testid (el formulario se usa en dos modales). */
  id: string;
  /** Nombres de ítems libres ya vendidos, para no escribir "Llavero LED" cinco veces distinto. */
  sugerencias: string[];
  onAgregar: (item: { nombre_producto: string; precio_unitario: number; cantidad: number }) => void;
}

/**
 * Agregar a una venta manual algo que no está en "Productos" (se vende solo por
 * otro canal). No tiene stock ni variantes: vale el nombre y el precio que se
 * escriben. Cerrado por defecto: lo normal es elegir un producto del catálogo.
 */
export default function ItemLibreForm({ id, sugerencias, onAgregar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState<number | ''>('');

  const valido = nombre.trim() !== '' && precio !== '' && Number(precio) >= 0 && cantidad >= 1;

  const cerrar = () => {
    setAbierto(false);
    setNombre('');
    setCantidad(1);
    setPrecio('');
  };

  const agregar = () => {
    if (!valido) return;
    onAgregar({ nombre_producto: nombre.trim(), precio_unitario: Number(precio), cantidad });
    cerrar();
  };

  if (!abierto) {
    return (
      <button type="button" data-testid={`${id}-abrir`} onClick={() => setAbierto(true)} className="mt-2 text-xs text-[var(--accent)] hover:underline">
        + Producto que no está en el catálogo
      </button>
    );
  }

  return (
    <div data-testid={id} className="mt-2 flex flex-col gap-2 rounded-[var(--radius-el)] border border-dashed border-[var(--line)] p-3">
      <p className="text-xs text-[var(--ink-soft)]">Para algo que no cargaste en Productos. No tiene stock: no descuenta ni controla nada.</p>
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[10rem]">
          <AdminLabel>Nombre</AdminLabel>
          <AdminInput
            list={`${id}-sugerencias`}
            value={nombre}
            maxLength={255}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Llavero LED personalizado"
            data-testid={`${id}-nombre`}
          />
          <datalist id={`${id}-sugerencias`}>
            {sugerencias.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="w-20">
          <AdminLabel>Cant.</AdminLabel>
          <AdminInput type="number" min={1} value={cantidad} onChange={e => setCantidad(Number(e.target.value) || 1)} data-testid={`${id}-cantidad`} />
        </div>
        <div className="w-28">
          <AdminLabel>Precio unit.</AdminLabel>
          <AdminInput type="number" min={0} value={precio} onChange={e => setPrecio(e.target.value === '' ? '' : Number(e.target.value))} data-testid={`${id}-precio`} />
        </div>
        <AdminButton variant="secondary" disabled={!valido} onClick={agregar} data-testid={`${id}-agregar`}>Agregar</AdminButton>
        <AdminButton variant="ghost" onClick={cerrar}>Cancelar</AdminButton>
      </div>
    </div>
  );
}

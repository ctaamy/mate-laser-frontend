import { useRef } from 'react';

// Guard genérico para formularios en modales: guarda un snapshot del form al
// abrir (o al cargar los datos originales de lo que se está editando) y, al
// intentar cerrar, compara contra el estado actual — si hay cambios sin
// guardar, pide confirmación antes de descartarlos. Pensado para que el
// mismo cerrarModal cubra backdrop-click, botón × y "Cancelar" de una sola
// vez (ver AdminModal.tsx y Productos.tsx).
export function useDirtyGuard<T>() {
  const snapshotRef = useRef<string>('');

  const marcarSnapshot = (data: T) => {
    snapshotRef.current = JSON.stringify(data);
  };

  const confirmarCierre = (data: T, mensaje = 'Hay cambios sin guardar. ¿Descartarlos?') => {
    if (JSON.stringify(data) === snapshotRef.current) return true;
    return window.confirm(mensaje);
  };

  return { marcarSnapshot, confirmarCierre };
}

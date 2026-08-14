import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

// Tabla compartida — reemplaza los 6 <table className="w-full"> hand-rolled
// (Productos, Ordenes, Cupones, Dashboard, Usuarios, PromocionesBancarias,
// ver audit Fase 5 punto 6) y estandariza loading/empty/error, que hoy
// varían entre pantallas: algunas no distinguen "cargando" de "vacío real"
// (mismo bug que se arregló puntualmente en Dashboard.tsx/Usuarios.tsx),
// Envios.tsx tiene su propio "Cargando..." con otro color. Acá queda
// centralizado, una sola vez.
interface AdminTableProps {
  columns: string[];
  children: ReactNode; // filas <tr>, ya armadas por el caller (los datos son muy distintos entre pantallas)
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  loadingRows?: number; // cantidad de filas skeleton mientras carga
  emptyMessage?: ReactNode;
  errorMessage?: ReactNode;
}

export default function AdminTable({
  columns, children, isLoading, isError, isEmpty,
  loadingRows = 4, emptyMessage = 'No se encontraron resultados',
  errorMessage = 'No se pudo cargar la información. Probá recargar la página.',
}: AdminTableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-[var(--n-100)] text-xs text-[var(--ink-soft)] font-medium">
          {columns.map((c) => (
            <th key={c} className="text-left px-5 py-3">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: loadingRows }).map((_, i) => (
            <tr key={i} className="border-t border-[var(--line)] animate-pulse">
              {columns.map((_, j) => (
                <td key={j} className="px-5 py-3">
                  <div className="h-3 w-20 bg-[var(--n-200)] rounded" />
                </td>
              ))}
            </tr>
          ))
        ) : (
          children
        )}
      </tbody>
      {!isLoading && isError && (
        <tfoot>
          <tr>
            <td colSpan={columns.length} className="text-center py-12">
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--error)]">
                <AlertCircle size={15} /> {errorMessage}
              </div>
            </td>
          </tr>
        </tfoot>
      )}
      {!isLoading && !isError && isEmpty && (
        <tfoot>
          <tr>
            <td colSpan={columns.length} className="text-center py-12 text-sm text-[var(--ink-soft)]">
              {emptyMessage}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

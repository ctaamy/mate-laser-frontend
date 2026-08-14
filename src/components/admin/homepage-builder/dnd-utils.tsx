import type { ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export { arrayMove };

// ── Lista ordenable genérica (Fase 2-3 del rediseño del builder) ─────────────
// Envuelve un DndContext + SortableContext propios (namespace de ids propio,
// separado de cualquier otro SortableContext anidado — ver comentario en
// SeccionCard sobre el DndContext "padre" de secciones vs. estos "hijos").
// Reutilizado por: secciones (Configuracion.tsx), slides del Hero,
// EnlacesEditor (links de navbar/footer, grupos y redes), categorías, stats
// y filtros rápidos.
export function SortableList<T>({ items, getId, onReorder, onDragStateChange, disabled, children }: {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  onDragStateChange?: (active: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const handleDragEnd = (event: DragEndEvent) => {
    onDragStateChange?.(false);
    if (disabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={disabled ? [] : sensors}
      collisionDetection={closestCenter}
      onDragStart={() => onDragStateChange?.(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => onDragStateChange?.(false)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// ── Handle de arrastre reutilizable ───────────────────────────────────────────
// Área táctil real (~24x24) — el drag SOLO arranca desde acá, nunca desde el
// resto de la card/fila (que tiene tabs, botones e inputs propios).
export function DragHandle({ attributes, listeners, disabled, size = 16, className = '', label = 'Arrastrar para reordenar' }: {
  attributes: Record<string, any>; listeners: Record<string, any> | undefined; disabled?: boolean;
  size?: number; className?: string; label?: string;
}) {
  return (
    <button type="button" {...attributes} {...listeners} disabled={disabled}
      aria-label={label}
      className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-[var(--n-300)] cursor-grab active:cursor-grabbing touch-none hover:text-[var(--ink-soft)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      <GripVertical size={size} />
    </button>
  );
}

// ── Hook: envuelve useSortable con el estilo de transform/transition +
// feedback visual (sombra + leve rotación) mientras se arrastra el item.
export function useSortableItem(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const baseTransform = CSS.Transform.toString(transform);
  const style: React.CSSProperties = {
    transform: isDragging && baseTransform ? `${baseTransform} rotate(1.5deg)` : baseTransform,
    transition,
    ...(isDragging ? { zIndex: 30, boxShadow: '0 10px 28px rgba(0,0,0,0.18)', position: 'relative' as const } : {}),
  };
  return { attributes, listeners, setNodeRef, style, isDragging };
}

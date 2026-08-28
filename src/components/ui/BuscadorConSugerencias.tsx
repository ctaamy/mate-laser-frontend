import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useSugerencias, type Sugerencia } from '../../hooks/useSugerencias';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Enter sin sugerencia activa (búsqueda "libre"). Si no se pasa, navega a /productos?q= */
  onSubmitLibre?: (v: string) => void;
  /** Se llama después de navegar a un producto (p. ej. para cerrar el panel mobile) */
  onNavegar?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Clase del wrapper (posicionamiento). Debe permitir `position: relative`. */
  className?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
  iconColor?: string;
  /** Muestra la X para limpiar dentro del input (catálogo). */
  clearable?: boolean;
  /**
   * 'popover' (default): dropdown flotante absoluto debajo del input.
   * 'inline': dropdown en el flujo normal — para contenedores con overflow:hidden
   * (el panel expandible del navbar en mobile).
   */
  dropdown?: 'popover' | 'inline';
}

// Resalta en negrita los tramos del nombre que matchean el término tipeado.
function resaltar(nombre: string, termino: string) {
  const t = termino.trim();
  if (!t) return nombre;
  // Solo lowercase (sin normalizar tildes): así los índices de `nombreNorm`
  // siguen alineados 1:1 con `nombre` y el resaltado no se corre. El match
  // insensible a tildes ya lo hizo el backend al elegir las sugerencias.
  const nombreNorm = nombre.toLowerCase();
  const tokens = [...new Set(t.toLowerCase().split(/\s+/).filter(Boolean))];
  const hit = new Array(nombre.length).fill(false);
  for (const tok of tokens) {
    let desde = 0;
    let i: number;
    while ((i = nombreNorm.indexOf(tok, desde)) !== -1) {
      for (let k = i; k < i + tok.length; k++) hit[k] = true;
      desde = i + tok.length;
    }
  }
  const partes: { texto: string; on: boolean }[] = [];
  for (let i = 0; i < nombre.length; i++) {
    const on = hit[i];
    if (!partes.length || partes[partes.length - 1].on !== on) partes.push({ texto: '', on });
    partes[partes.length - 1].texto += nombre[i];
  }
  return partes.map((p, i) =>
    p.on ? <strong key={i} className="font-semibold">{p.texto}</strong> : <span key={i}>{p.texto}</span>,
  );
}

export default function BuscadorConSugerencias({
  value,
  onChange,
  onSubmitLibre,
  onNavegar,
  placeholder = 'Buscar',
  autoFocus,
  className = '',
  inputClassName = '',
  inputStyle,
  iconColor = '#6b7280',
  clearable = false,
  dropdown = 'popover',
}: Props) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const { sugerencias, isFetching } = useSugerencias(value, abierto);
  const mostrarLista = abierto && value.trim().length >= 1 && (sugerencias.length > 0 || isFetching);
  // El índice activo puede quedar fuera de rango si la lista se achicó entre
  // teclas; se clampa en el render y todo acceso pasa por sugerencias[idx].
  const idxActivo = activo < sugerencias.length ? activo : -1;

  // Click afuera cierra.
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);

  const irAProducto = (s: Sugerencia) => {
    setAbierto(false);
    setActivo(-1);
    navigate(`/productos/${s.slug}`);
    onNavegar?.();
  };

  const submitLibre = () => {
    const q = value.trim();
    setAbierto(false);
    if (onSubmitLibre) onSubmitLibre(q);
    else if (q) navigate(`/productos?q=${encodeURIComponent(q)}`);
    onNavegar?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!mostrarLista || sugerencias.length === 0) return;
      setAbierto(true);
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (sugerencias.length === 0) return;
      setActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (idxActivo >= 0 && sugerencias[idxActivo]) {
        e.preventDefault();
        irAProducto(sugerencias[idxActivo]);
      } else {
        submitLibre();
      }
    } else if (e.key === 'Escape') {
      setAbierto(false);
      setActivo(-1);
    }
  };

  const lista = mostrarLista && (
    <ul
      id={listboxId}
      role="listbox"
      className={
        dropdown === 'popover'
          ? 'absolute left-0 right-0 top-full mt-2 z-[60] overflow-hidden rounded-xl border border-black/10 bg-white py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.14)]'
          : 'mt-2 overflow-hidden rounded-xl border border-black/10 bg-white py-1.5'
      }
    >
      {sugerencias.length === 0 && isFetching && (
        <li className="px-3 py-2.5 text-[13px] text-black/35">Buscando...</li>
      )}
      {sugerencias.map((s, i) => (
        <li key={s.slug} role="option" aria-selected={i === idxActivo}>
          <button
            type="button"
            // onMouseDown en vez de onClick: el blur del input dispara antes
            // que el click y cerraría la lista antes de navegar.
            onMouseDown={(e) => { e.preventDefault(); irAProducto(s); }}
            onMouseEnter={() => setActivo(i)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              i === idxActivo ? 'bg-black/[0.06]' : 'hover:bg-black/[0.04]'
            }`}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04]">
              {s.imagen ? (
                <img src={s.imagen} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Search size={13} className="text-black/25" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-black/80">
              {resaltar(s.nombre, value)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: iconColor }}
        />
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(e) => { onChange(e.target.value); setActivo(-1); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={onKeyDown}
          className={inputClassName}
          style={inputStyle}
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => { onChange(''); setAbierto(false); }}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/25 transition-colors hover:text-black"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {lista}
    </div>
  );
}

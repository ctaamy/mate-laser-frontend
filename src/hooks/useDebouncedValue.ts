import { useEffect, useState } from 'react';

/**
 * Devuelve `value` recién después de que pasen `delay` ms sin que cambie.
 * Se usa para no disparar un request por cada tecla en los buscadores.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

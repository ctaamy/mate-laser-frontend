import { test, expect } from '@playwright/test';
import { construirArbol } from '../src/lib/categoriasArbol';

const cat = (id: number, nombre: string, padre_id: number | null, extra: Record<string, any> = {}) =>
  ({ id, nombre, slug: nombre.toLowerCase(), padre_id, orden: 0, activo: true, ...extra }) as any;

test.describe('construirArbol', () => {
  test('arma raíces con hijas y un índice por id', () => {
    const { raices, porId } = construirArbol([cat(1, 'Mates', null), cat(2, 'Calabaza', 1), cat(3, 'Termos', null)]);
    expect(raices.map((r) => r.nombre)).toEqual(['Mates', 'Termos']);
    expect(raices[0].hijas.map((h) => h.nombre)).toEqual(['Calabaza']);
    expect(porId.get(2)?.nombre).toBe('Calabaza');
  });

  test('orden estable: orden, luego nombre (es), luego id — aunque haya empates', () => {
    const { raices } = construirArbol([
      cat(1, 'Bombillones', null, { orden: 2 }),
      cat(2, 'Bombillas', null, { orden: 2 }),
      cat(3, 'Álamo', null, { orden: 2 }),
      cat(4, 'Mates', null, { orden: 1 }),
    ]);
    expect(raices.map((r) => r.nombre)).toEqual(['Mates', 'Álamo', 'Bombillas', 'Bombillones']);
  });

  test('descarta hijas huérfanas (padre inexistente o inactivo)', () => {
    const { raices, porId } = construirArbol([cat(1, 'Mates', null), cat(9, 'Suelta', 99)]);
    expect(raices).toHaveLength(1);
    expect(porId.has(9)).toBe(false);
  });

  test('ocultarVacias oculta solo cantidad_productos === 0; undefined se muestra', () => {
    const { raices } = construirArbol(
      [
        cat(1, 'Mates', null, { cantidad_productos: 5 }),
        cat(2, 'Calabaza', 1, { cantidad_productos: 5 }),
        cat(3, 'Acero', 1, { cantidad_productos: 0 }),
        cat(4, 'Termos', null, { cantidad_productos: 0 }),
        cat(5, 'Sin dato', null),
      ],
      { ocultarVacias: true },
    );
    expect(raices.map((r) => r.nombre)).toEqual(['Mates', 'Sin dato']);
    expect(raices[0].hijas.map((h) => h.nombre)).toEqual(['Calabaza']);
  });

  test('la categoría seleccionada (y su padre) no se ocultan aunque estén vacías', () => {
    const { raices } = construirArbol(
      [
        cat(1, 'Diseños', null, { cantidad_productos: 0 }),
        cat(2, 'Signos', 1, { cantidad_productos: 0 }),
        cat(3, 'Termos', null, { cantidad_productos: 0 }),
      ],
      { ocultarVacias: true, seleccionadaId: 2 },
    );
    expect(raices.map((r) => r.nombre)).toEqual(['Diseños']);
    expect(raices[0].hijas.map((h) => h.nombre)).toEqual(['Signos']);
  });

  test('sin ocultarVacias muestra todo', () => {
    const { raices } = construirArbol([cat(1, 'Termos', null, { cantidad_productos: 0 })]);
    expect(raices).toHaveLength(1);
  });
});

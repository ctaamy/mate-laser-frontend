import { test, expect } from '@playwright/test';
import { antesDeEnviarAUmami, limpiarUrlParaAnalitica } from '../src/lib/urlAnalitica';

// Umami manda la URL completa de cada página con su query string. Varias
// pantallas llevan secretos ahí (tokens de login con Google, reset de
// contraseña, verificación y baja; el id de un pedido). Lógica pura, sin browser.

const UUID = '3fff1e9f-1450-4184-917b-cd200b436b68';

test.describe('limpiarUrlParaAnalitica', () => {
  test('el callback de Google no manda ni el token ni el refreshToken', () => {
    expect(limpiarUrlParaAnalitica('/auth/google/callback?token=aaa.bbb.ccc&refreshToken=abc123')).toBe(
      '/auth/google/callback',
    );
  });

  test.describe('rutas con un token en el query', () => {
    for (const ruta of ['/resetear-password', '/verificar-email', '/baja-newsletter', '/confirmar-newsletter']) {
      test(ruta, () => {
        expect(limpiarUrlParaAnalitica(`${ruta}?token=secreto`)).toBe(ruta);
      });
    }
  });

  test('el id del pedido se reemplaza por un comodín en confirmación, pago y Mi cuenta', () => {
    expect(limpiarUrlParaAnalitica(`/confirmacion/${UUID}`)).toBe('/confirmacion/:id');
    expect(limpiarUrlParaAnalitica(`/pago/${UUID}`)).toBe('/pago/:id');
    expect(limpiarUrlParaAnalitica(`/mi-cuenta/pedidos/${UUID}`)).toBe('/mi-cuenta/pedidos/:id');
  });

  test('conserva el resto del query de la confirmación (por ejemplo ?mp=success)', () => {
    expect(limpiarUrlParaAnalitica(`/confirmacion/${UUID}?mp=success`)).toBe('/confirmacion/:id?mp=success');
  });

  test('NO borra los utm de las campañas ni los filtros del catálogo', () => {
    expect(limpiarUrlParaAnalitica('/productos?utm_source=instagram&utm_campaign=octubre')).toBe(
      '/productos?utm_source=instagram&utm_campaign=octubre',
    );
    expect(limpiarUrlParaAnalitica('/productos?categoria_id=6&q=mate')).toBe('/productos?categoria_id=6&q=mate');
    expect(limpiarUrlParaAnalitica('/productos?cupon=MATE20')).toBe('/productos?cupon=MATE20');
  });

  test('un token suelto en cualquier otra ruta tampoco viaja', () => {
    expect(limpiarUrlParaAnalitica('/productos?token=abc&utm_source=ig')).toBe('/productos?utm_source=ig');
    expect(limpiarUrlParaAnalitica('/login?refreshToken=abc')).toBe('/login');
  });

  test('las páginas comunes quedan igual', () => {
    for (const url of ['/', '/productos', '/productos/mate-imperial', '/carrito', '/checkout', '/nosotros']) {
      expect(limpiarUrlParaAnalitica(url)).toBe(url);
    }
  });

  test('acepta una URL completa y devuelve una URL completa', () => {
    expect(limpiarUrlParaAnalitica(`https://matelaserstudio.com.ar/confirmacion/${UUID}?mp=success`)).toBe(
      'https://matelaserstudio.com.ar/confirmacion/:id?mp=success',
    );
    expect(limpiarUrlParaAnalitica('https://matelaserstudio.com.ar/resetear-password?token=x#a')).toBe(
      'https://matelaserstudio.com.ar/resetear-password#a',
    );
  });

  test('barra final y mayúsculas en la ruta no la saltean', () => {
    expect(limpiarUrlParaAnalitica('/resetear-password/?token=secreto')).toBe('/resetear-password/');
    expect(limpiarUrlParaAnalitica(`/Confirmacion/${UUID}`)).toBe('/Confirmacion/:id');
  });

  test('una URL imposible de interpretar se devuelve tal cual, sin romper', () => {
    expect(() => limpiarUrlParaAnalitica('http://')).not.toThrow();
    expect(limpiarUrlParaAnalitica('')).toBe('');
  });
});

test.describe('antesDeEnviarAUmami (hook data-before-send)', () => {
  test('limpia payload.url y devuelve el payload completo (si no devolviera nada, Umami no enviaría)', () => {
    const payload = { website: 'w', hostname: 'matelaserstudio.com.ar', url: `/confirmacion/${UUID}`, title: 'Pedido' };
    const salida = antesDeEnviarAUmami('event', payload);
    expect(salida).toMatchObject({ website: 'w', title: 'Pedido', url: '/confirmacion/:id' });
  });

  test('un payload sin url pasa intacto', () => {
    expect(antesDeEnviarAUmami('event', { name: 'nav_categoria_click' })).toEqual({ name: 'nav_categoria_click' });
  });
});

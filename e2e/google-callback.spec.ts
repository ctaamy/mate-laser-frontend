import { test, expect } from '@playwright/test';
import { leerTokensDeGoogle } from '../src/lib/tokensGoogle';

// Los tokens del login con Google viajan en el fragmento (#), no en la query.

test.describe('leerTokensDeGoogle (lógica pura)', () => {
  test('lee los tokens del fragmento', () => {
    expect(leerTokensDeGoogle('#token=aaa.bbb.ccc&refreshToken=r1', '')).toEqual({
      token: 'aaa.bbb.ccc',
      refreshToken: 'r1',
    });
  });

  test('respaldo: también lee la query (backend viejo durante el deploy)', () => {
    expect(leerTokensDeGoogle('', '?token=t&refreshToken=r')).toEqual({ token: 't', refreshToken: 'r' });
  });

  test('el fragmento tiene prioridad sobre la query', () => {
    expect(leerTokensDeGoogle('#token=nuevo&refreshToken=rn', '?token=viejo&refreshToken=rv')).toEqual({
      token: 'nuevo',
      refreshToken: 'rn',
    });
  });

  test('null si falta alguno de los dos o no hay nada', () => {
    expect(leerTokensDeGoogle('#token=solo', '')).toBeNull();
    expect(leerTokensDeGoogle('#refreshToken=solo', '')).toBeNull();
    expect(leerTokensDeGoogle('', '')).toBeNull();
  });
});

test.describe('página /auth/google/callback', () => {
  const PERFIL = {
    id: 'u1', email: 'ana@test.com', nombre: 'Ana', apellido: 'Paz', rol: 'cliente', email_verificado: true,
  };

  test('con tokens en el fragmento inicia sesión, guarda los tokens y deja la barra limpia', async ({ page }) => {
    await page.route('**/api/v1/usuarios/perfil', (r) => r.fulfill({ json: PERFIL }));

    await page.goto('/auth/google/callback#token=JWT.AAA.BBB&refreshToken=rt-123');

    await expect(page).toHaveURL(/\/$/); // fue al inicio
    expect(page.url()).not.toContain('JWT.AAA.BBB');
    expect(page.url()).not.toContain('rt-123');
    const guardado = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      refreshToken: localStorage.getItem('refreshToken'),
    }));
    expect(guardado).toEqual({ token: 'JWT.AAA.BBB', refreshToken: 'rt-123' });
  });

  test('sin tokens vuelve al login con el error de Google', async ({ page }) => {
    await page.goto('/auth/google/callback');
    await expect(page).toHaveURL(/\/login\?error=google_denied/);
  });

  test('aun si llegan por la query (backend viejo) los saca de la barra', async ({ page }) => {
    await page.route('**/api/v1/usuarios/perfil', (r) => r.fulfill({ json: PERFIL }));
    await page.goto('/auth/google/callback?token=T1&refreshToken=R1');
    await expect(page).toHaveURL(/\/$/);
    expect(page.url()).not.toContain('T1');
  });
});

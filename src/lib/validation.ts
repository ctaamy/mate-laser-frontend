// Misma regla que el backend (ver ResetearPasswordDto / RegisterDto):
// al menos 8 caracteres, con al menos una letra y un número.
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*[0-9]).+$/;

export function validarPassword(password: string): string | null {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'La contraseña debe tener al menos una letra y un número';
  }
  return null;
}

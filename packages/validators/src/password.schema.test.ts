import { describe, it, expect } from 'vitest';
import { passwordSchema } from './password.schema';

describe('passwordSchema', () => {
  it('acepta contraseña con mayúscula, minúscula y número (8+ chars)', () => {
    const result = passwordSchema.safeParse('Abcdef1x');
    expect(result.success).toBe(true);
  });

  it('acepta contraseña larga y compleja', () => {
    const result = passwordSchema.safeParse('MySecure123Password!');
    expect(result.success).toBe(true);
  });

  it('rechaza contraseña con menos de 8 caracteres', () => {
    const result = passwordSchema.safeParse('Ab1cdef');
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin mayúscula', () => {
    const result = passwordSchema.safeParse('abcdefgh1');
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin minúscula', () => {
    const result = passwordSchema.safeParse('ABCDEFGH1');
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña sin número', () => {
    const result = passwordSchema.safeParse('Abcdefgh');
    expect(result.success).toBe(false);
  });

  it('rechaza string vacío', () => {
    const result = passwordSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

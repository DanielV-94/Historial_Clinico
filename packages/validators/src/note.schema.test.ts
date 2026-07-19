import { describe, it, expect } from 'vitest';
import { clinicalNoteContentSchema, NOTE_MAX_LENGTH } from './note.schema';

describe('clinicalNoteContentSchema', () => {
  it('acepta una nota con contenido válido', () => {
    const result = clinicalNoteContentSchema.safeParse('Paciente presenta mejoría significativa.');
    expect(result.success).toBe(true);
  });

  it('acepta nota con exactamente 1 caracter', () => {
    const result = clinicalNoteContentSchema.safeParse('A');
    expect(result.success).toBe(true);
  });

  it('acepta nota con exactamente 10,000 caracteres', () => {
    const result = clinicalNoteContentSchema.safeParse('X'.repeat(10_000));
    expect(result.success).toBe(true);
  });

  it('rechaza string vacío', () => {
    const result = clinicalNoteContentSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rechaza nota con más de 10,000 caracteres', () => {
    const result = clinicalNoteContentSchema.safeParse('X'.repeat(NOTE_MAX_LENGTH + 1));
    expect(result.success).toBe(false);
  });
});

/** Adapter-side translation failure (bad JSON, already-consumed multipart body). */
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

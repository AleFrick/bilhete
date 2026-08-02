const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const DATA_URL_RE = /^data:([a-zA-Z0-9][a-zA-Z0-9!#$&^_\-+.]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_\-+.]*);base64,([A-Za-z0-9+/=]*)$/;

export function validateImageDataUrl(value, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (typeof value !== 'string' || !value) {
    return { valid: false, error: 'Imagem invalida.' };
  }

  if (value.length > maxBytes * 1.4) {
    return { valid: false, error: `Imagem muito grande. Maximo ${Math.round(maxBytes / 1024 / 1024)}MB.` };
  }

  const match = value.match(DATA_URL_RE);
  if (!match) {
    return { valid: false, error: 'Formato de imagem invalido. Use data URL base64.' };
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `Tipo de imagem nao permitido: ${mimeType}. Use JPEG, PNG, WebP ou GIF.` };
  }

  const base64Data = match[2];
  const decodedSize = Math.floor((base64Data.length * 3) / 4);
  if (decodedSize > maxBytes) {
    return { valid: false, error: `Imagem muito grande. Maximo ${Math.round(maxBytes / 1024 / 1024)}MB.` };
  }

  return { valid: true };
}

export function validateImageDataUrls(values, options) {
  if (!Array.isArray(values)) {
    return { valid: false, error: 'Lista de imagens invalida.' };
  }

  for (const value of values) {
    const result = validateImageDataUrl(value, options);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Converte uma string para slug (URL-friendly)
 *
 * ✅ lowercase
 * ✅ remover acentos
 * ✅ converter espaços/separadores em hífen
 * ✅ colapsar múltiplos hífens num único
 * ✅ remover caracteres inválidos
 * ✅ remover hífen inicial/final
 * ✅ comportamento determinístico
 */

export function toSlug(text: string): string {
  if (!text) return ''

  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}
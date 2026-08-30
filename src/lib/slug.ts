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
  
  // lowercase
  let slug = text.toLowerCase()
  
  // remover acentos (NFD + remover combining marks)
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // converter espaços e separadores variadós em hífen
  slug = slug.replace(/[^\w\s\u00C0-\u024F]+/g, '-')
  
  // colapsar múltiplos hífens num único
  slug = slug.replace(/-+/g, '-')
  
  // remover hífen inicial e final
  slug = slug.replace(/^-*|-*$/, '')
  
  return slug.trim()
}

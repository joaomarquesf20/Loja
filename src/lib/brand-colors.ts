/**
 * Rampa de cor derivada do hex primário definido no backoffice
 * (Configurações → cor da loja). Mantém o sistema visual (as
 * classes `bg-brand`, `text-brand`, `hover:bg-brand-strong`) a
 * funcionar sobre qualquer cor introduzida pelo administrador.
 */

/**
 * Converte `#RRGGBB` (6 dígitos) num triplo 0–255.
 * Devolve `null` quando o formato não é reconhecido.
 */
export function parseHexColor(
  value: string,
): { r: number; g: number; b: number } | null {
  const normalized = value.trim()

  const match =
    /^#([0-9a-fA-F]{6})$/.exec(normalized)

  if (!match) {
    return null
  }

  const hex = match[1]

  return {
    r: Number.parseInt(
      hex.slice(0, 2),
      16,
    ),
    g: Number.parseInt(
      hex.slice(2, 4),
      16,
    ),
    b: Number.parseInt(
      hex.slice(4, 6),
      16,
    ),
  }
}

/**
 * Escurece o primário 12% — usado em estados `hover`
 * (`--brand-strong`) para manter a mesma matiz.
 */
export function darkenHexColor(
  value: string,
  amount = 0.12,
): string | null {
  const color = parseHexColor(value)

  if (!color) {
    return null
  }

  const toChannel = (channel: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          channel * (1 - amount),
        ),
      ),
    )

  const r = toChannel(color.r)
  const g = toChannel(color.g)
  const b = toChannel(color.b)

  const toHex = (channel: number) =>
    channel.toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Tinta suave do primário (12% sobre branco) para fundos
 * neutros de realce — `--brand-soft` (chips, avisos leves).
 */
export function lightenHexColor(
  value: string,
  mix = 0.12,
): string | null {
  const color = parseHexColor(value)

  if (!color) {
    return null
  }

  const toChannel = (channel: number) =>
    Math.round(
      channel + (255 - channel) * mix,
    )

  const r = toChannel(color.r)
  const g = toChannel(color.g)
  const b = toChannel(color.b)

  const toHex = (channel: number) =>
    channel.toString(16).padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Gera o bloco de variáveis CSS a injetar no `<head>` do
 * layout: a cor introduzida substitui os defaults do template.
 */
export function buildBrandCssVariables(
  primaryColorHex: string,
): string | null {
  const strong =
    darkenHexColor(primaryColorHex)
  const soft = lightenHexColor(
    primaryColorHex,
  )

  if (!strong || !soft) {
    return null
  }

  return [
    `--brand: ${primaryColorHex};`,
    `--brand-strong: ${strong};`,
    `--brand-soft: ${soft};`,
  ].join(' ')
}

/**
 * Identidade "white-label" do template. Estes valores são os DEFAULTS
 * neutros usados quando o administrador ainda não configurou a loja
 * (linha `StoreSettings` inexistente ou campos `null`).
 *
 * Vive fora do servidor para que componentes de cliente, templates de
 * email e páginas de erro não dependam de módulos de backend.
 */

/** Base para chaves de storage do browser (genérica, sem marca). */
export const STORE_STORAGE_PREFIX = 'store'

/** URL do logótipo por omissão (asta public/). */
export const DEFAULT_LOGO_URL_DARK =
  '/brand/logo-horizontal-dark.png'

/** Logótipo alternativo para fundos claros. */
export const DEFAULT_LOGO_URL_LIGHT =
  '/brand/logo-horizontal.png'

/**
 * Cor primária do template: o mesmo hex que alimenta
 * `--brand`/`--brand-strong`/`--brand-soft` em `globals.css`.
 */
export const DEFAULT_PRIMARY_COLOR = '#ef5b2a'

/**
 * Nome destilado da loja. Nunca deve conter a marca de um cliente
 * específico — o nome real é configurado no admin (Configurações).
 */
export const DEFAULT_STORE_NAME = 'AutoParts'

/**
 * Descrição default de SEO, neutra e configurável via
 * admin (a `StoreSettings` futura pode guardá-la).
 */
export const DEFAULT_STORE_DESCRIPTION =
  'Catálogo de peças e acessórios automóvel com compatibilidade por veículo.'

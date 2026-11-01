import {
  DEFAULT_STORE_NAME,
} from '../lib/brand-defaults'

/**
 * Identidade da loja usada nos emails transacionais (fallback quando
 * o branding não está configurado). Vive fora do servidor para que os
 * templates React Email não dependam de módulos de backend. O nome
 * real vem do backoffice (Configurações → StoreSettings) e é injetado
 * pelo serviço de email através da prop `storeName`.
 */
export const STORE_NAME = DEFAULT_STORE_NAME

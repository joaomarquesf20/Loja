import { cache } from 'react'

import {
  listCatalogCategories,
  type CatalogCategory,
} from './catalog'

/**
 * Leitura de categorias memoizada por pedido (React `cache`).
 *
 * O layout (cabeçalho e rodapé) e as páginas de catálogo pedem as
 * mesmas categorias dentro do mesmo request; este wrapper deduplica
 * essas chamadas para UMA única consulta à base de dados por request.
 * Não há TTL nem pré-geração — a frescura mantém-se: o resultado
 * continua a ser recalculado a cada novo request.
 *
 * Não invocar fora de um render de servidor (fora do request React a
 * memoização deixa de ser por pedido); nos testes, continuar a usar
 * `listCatalogCategories` com o cliente injetável da §13.
 */
export const getCatalogCategories = cache(
  listCatalogCategories,
) as () => Promise<CatalogCategory[]>

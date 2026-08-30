// Tipo mínimo para o cliente de stock - INJETÁVEL (NÃO depende de @prisma/client)
type StockClient = {
  product: {
    updateMany(args: {
      where: {
        id: string
        stockQuantity: {
          gte: number
        }
      }
      data: {
        stockQuantity: {
          decrement: number
        }
      }
    }): Promise<{ count: number }>
  }
}

/**
 * Função para decrementar stock de forma segura usando atualização condicional
 * 
 * Utiliza UPDATE com WHERE que inclui:
 * - id do produto
 * - stockQuantity >= quantity (verifica stock suficiente)
 * 
 * Validações:
 * - quantity deve ser inteiro positivo (Number.isInteger && > 0)
 * 
 * Se inválido: throw new Error("Quantidade inválida")
 * 
 * Se result.count !== 1: throw new Error("Stock insuficiente")
 */
export async function decrementStock(
  client: StockClient,
  productId: string,
  quantity: number
): Promise<void> {
  // Validar quantidade antes da operação
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantidade inválida")
  }

  const result = await client.product.updateMany({
    where: {
      id: productId,
      stockQuantity: {
        gte: quantity,
      },
    },
    data: {
      stockQuantity: {
        decrement: quantity,
      },
    },
  })

  // Verificar se exatamente um produto foi atualizado
  if (result.count !== 1) {
    throw new Error("Stock insuficiente")
  }
}

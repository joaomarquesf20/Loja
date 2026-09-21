type StockUpdateManyArgs = {
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
}

type StockDelegate = {
  updateMany(
    args: StockUpdateManyArgs,
  ): Promise<{
    count: number
  }>
}

export type StockClient = {
  product: StockDelegate
  productVariant?: StockDelegate
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      'Quantidade inválida',
    )
  }
}

async function decrementFromDelegate(
  delegate: StockDelegate,
  id: string,
  quantity: number,
) {
  validateQuantity(quantity)

  const result =
    await delegate.updateMany({
      where: {
        id,
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

  if (result.count !== 1) {
    throw new Error(
      'Stock insuficiente',
    )
  }
}

/**
 * Helper legado mantido durante a migração progressiva.
 * Os fluxos comerciais novos devem usar decrementVariantStock.
 */
export async function decrementStock(
  client: StockClient,
  productId: string,
  quantity: number,
): Promise<void> {
  return decrementFromDelegate(
    client.product,
    productId,
    quantity,
  )
}

/**
 * Decrementa atomicamente o stock da unidade vendável.
 */
export async function decrementVariantStock(
  client: StockClient,
  productVariantId: string,
  quantity: number,
): Promise<void> {
  if (!client.productVariant) {
    throw new Error(
      'Stock de variantes indisponível',
    )
  }

  return decrementFromDelegate(
    client.productVariant,
    productVariantId,
    quantity,
  )
}

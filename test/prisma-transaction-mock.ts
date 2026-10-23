import type { Mock } from 'vitest'

type TransactionCallback = (
  transactionClient: unknown,
) => Promise<unknown>

/**
 * Devolve a implementação de `$transaction` partilhada pelos testes de rota de
 * pagamentos: executa o callback com um cliente de transação que expõe apenas
 * as escritas usadas pelos serviços reais (`order.updateMany` e
 * `orderEvent.create`), ligadas aos espiões recebidos.
 *
 * Aqui vive somente a ligação dos espiões; o que cada teste resolve e verifica
 * continua local à respetiva suite.
 */
export function createOrderTransactionStub({
  updateMany,
  createEvent,
}: {
  updateMany: Mock
  createEvent: Mock
}) {
  return async (
    callback: TransactionCallback,
  ) =>
    callback({
      order: {
        updateMany,
      },
      orderEvent: {
        create: createEvent,
      },
    })
}

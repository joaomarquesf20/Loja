/**
 * Constrói erros `P2002` com a forma produzida pelo Prisma 7.10.0 com
 * `@prisma/adapter-pg` (verificada no código instalado do cliente): o alvo da
 * violação vive em `meta.driverAdapterError.cause` (`kind` e `constraint`,
 * como `{ index }` ou `{ fields }`). O cliente instalado nunca emite
 * `meta.target`.
 *
 * Este utilitário é partilhado pelos testes de pagamento para evitar que as
 * fixtures das suites divirjam entre si.
 */
export function createUniqueConstraintViolation(
  constraint: unknown,
) {
  return {
    code: 'P2002',
    meta: {
      modelName: 'Order',
      driverAdapterError: {
        cause: {
          kind:
            'UniqueConstraintViolation',
          constraint,
          table: 'Order',
          originalCode: '23505',
          originalMessage:
            'duplicate key value violates unique constraint',
        },
      },
    },
  }
}

import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'

import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '@/lib/order-status-labels'

import { STORE_NAME } from './brand'

/**
 * Template de atualização de estado de encomenda (enviado após ações
 * administrativas na rota de transição). Mostra sempre o estado atual
 * conhecido — é a fonte de verdade da base de dados no momento do envio.
 */
export type OrderStatusUpdateEmailProps = {
  orderNumber: string
  customerName: string
  status: string
  paymentStatus: string
  /** Data ISO 8601 do momento da alteração. */
  updatedAt: string
}

const dateFormatter =
  new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

function formatUpdatedAt(
  updatedAt: string,
) {
  const date = new Date(
    updatedAt,
  )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return updatedAt
  }

  return dateFormatter.format(
    date,
  )
}

const main = {
  backgroundColor: '#f4f5f7',
  fontFamily:
    'Helvetica, Arial, sans-serif',
  padding: '32px 0',
}

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '600px',
  padding: '32px',
}

const heading = {
  color: '#17181c',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 16px',
}

const paragraph = {
  color: '#3f4043',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
}

const paragraphWithMargin = {
  ...paragraph,
  margin: '0 0 12px',
}

const labelCell = {
  ...paragraphWithMargin,
  color: '#6b7280',
  fontSize: '13px',
}

const valueCell = {
  ...paragraphWithMargin,
  fontWeight: 600,
  textAlign: 'right' as const,
}

const muted = {
  ...paragraphWithMargin,
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
}

const footer = {
  ...muted,
  margin: '24px 0 0',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0 12px',
}

const table = {
  width: '100%' as const,
}

export function OrderStatusUpdateEmail(
  {
    orderNumber,
    customerName,
    status,
    paymentStatus,
    updatedAt,
  }: OrderStatusUpdateEmailProps,
) {
  const isCancelled =
    status === 'CANCELLED'

  const isRefunded =
    paymentStatus ===
    'REFUNDED'

  const normalizedCustomerName =
    customerName.trim()

  const orderStatusLabelValue =
    getOrderStatusLabel(
      status,
    )

  const paymentStatusLabelValue =
    getPaymentStatusLabel(
      paymentStatus,
    )

  return (
    <Html lang="pt-PT">
      <Head />
      <Preview>
        {`Atualização da encomenda ${orderNumber}`}
      </Preview>
      <Body style={main}>
        <Container
          style={container}
        >
          <Heading style={heading}>
            {STORE_NAME}
          </Heading>

          <Text
            style={
              paragraphWithMargin
            }
          >
            {normalizedCustomerName
              ? `Olá, ${normalizedCustomerName}!`
              : 'Olá!'}{' '}
            {isCancelled
              ? `A encomenda ${orderNumber} foi cancelada.`
              : isRefunded
                ? `O pagamento da encomenda ${orderNumber} foi reembolsado.`
                : `O estado da encomenda ${orderNumber} foi atualizado.`}
          </Text>

          <Section style={table}>
            <Row>
              <Column
                style={labelCell}
              >
                Estado da
                encomenda
              </Column>
              <Column
                style={valueCell}
              >
                {
                  orderStatusLabelValue
                }
              </Column>
            </Row>
            <Row>
              <Column
                style={labelCell}
              >
                Estado do
                pagamento
              </Column>
              <Column
                style={valueCell}
              >
                {
                  paymentStatusLabelValue
                }
              </Column>
            </Row>
            <Row>
              <Column
                style={labelCell}
              >
                Atualizada
              </Column>
              <Column
                style={valueCell}
              >
                {formatUpdatedAt(
                  updatedAt,
                )}
              </Column>
            </Row>
          </Section>

          {isCancelled ? (
            <Text style={muted}>
              Se não reconhece esta
              alteração, contacte o
              nosso apoio ao
              cliente.
            </Text>
          ) : (
            <Text style={muted}>
              Pode consultar todos
              os detalhes na sua
              conta em {STORE_NAME}.
            </Text>
          )}

          <Hr style={divider} />

          <Text style={footer}>
            Recebeu este email
            porque acompanhava a
            encomenda{' '}
            {orderNumber} em{' '}
            {STORE_NAME}. Não
            responda a este email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default OrderStatusUpdateEmail

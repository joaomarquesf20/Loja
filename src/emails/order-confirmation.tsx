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

import { STORE_NAME } from './brand'

/**
 * Template de confirmação de encomenda (enviado quando o pagamento é
 * confirmado pelo webhook). Os valores chegam em cêntimos inteiros e são
 * formatados aqui para euros em pt-PT.
 */
export type OrderConfirmationEmailItemOption = {
  name: string
  value: string
}

export type OrderConfirmationEmailItem = {
  productName: string
  sku: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  options: OrderConfirmationEmailItemOption[]
}

export type OrderConfirmationEmailShippingAddress =
  {
    name: string
    line1: string
    line2: string | null
    postalCode: string | null
    city: string | null
    country: string | null
  }

export type OrderConfirmationEmailProps = {
  orderNumber: string
  customerName: string
  fulfillmentMethod:
    | 'DELIVERY'
    | 'PICKUP'
  shippingAddress:
    | OrderConfirmationEmailShippingAddress
    | null
  items: OrderConfirmationEmailItem[]
  subtotalCents: number
  shippingCostCents: number
  taxCents: number
  totalCents: number
}

const moneyFormatter = new Intl.NumberFormat(
  'pt-PT',
  {
    style: 'currency',
    currency: 'EUR',
  },
)

function formatMoneyCents(
  cents: number,
) {
  return moneyFormatter.format(
    cents / 100,
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

const paragraphStrong = {
  ...paragraphWithMargin,
  color: '#17181c',
  fontWeight: 600,
}

const sectionHeading = {
  ...paragraphStrong,
  margin: '24px 0 8px',
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

const table = {
  width: '100%' as const,
}

const tableHeaderCell = {
  ...paragraphStrong,
  borderBottom: '2px solid #e5e7eb',
  fontSize: '12px',
  paddingBottom: '6px',
  textTransform:
    'uppercase' as const,
}

const tableHeaderCellRight = {
  ...tableHeaderCell,
  textAlign: 'right' as const,
}

const tableCell = {
  ...paragraph,
  borderBottom: '1px solid #e5e7eb',
  paddingBottom: '8px',
  paddingTop: '8px',
  verticalAlign: 'top' as const,
}

const tableCellRight = {
  ...tableCell,
  textAlign: 'right' as const,
}

const totalRowLabel = {
  ...paragraphStrong,
  borderTop: '2px solid #17181c',
  paddingTop: '8px',
}

const totalValue = {
  ...totalRowLabel,
  textAlign: 'right' as const,
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0 12px',
}

function formatDeliveryAddress(
  address: OrderConfirmationEmailShippingAddress,
) {
  const lines = [
    address.name,
    address.line1,
    address.line2,
    [
      address.postalCode,
      address.city,
    ]
      .filter(Boolean)
      .join(' '),
    address.country,
  ].filter(
    (line): line is string =>
      Boolean(line),
  )

  return lines.join('\n')
}

export function OrderConfirmationEmail(
  {
    orderNumber,
    customerName,
    fulfillmentMethod,
    shippingAddress,
    items,
    subtotalCents,
    shippingCostCents,
    taxCents,
    totalCents,
  }: OrderConfirmationEmailProps,
) {
  const normalizedCustomerName =
    customerName.trim()

  const isPickup =
    fulfillmentMethod ===
    'PICKUP'

  const orderReference = (
    <strong>{orderNumber}</strong>
  )

  return (
    <Html lang="pt-PT">
      <Head />
      <Preview>
        {`Encomenda ${orderNumber} confirmada`}
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
            A sua encomenda{' '}
            {orderReference} foi
            confirmada e o
            pagamento recebido.
            Obrigado pela compra!
          </Text>

          <Text
            style={sectionHeading}
          >
            Artigos
          </Text>
          <Section style={table}>
            <Row>
              <Column
                style={
                  tableHeaderCell
                }
              >
                Artigo
              </Column>
              <Column
                style={
                  tableHeaderCellRight
                }
                colSpan={2}
              >
                Valor
              </Column>
            </Row>

            {items.map(
              (item, index) => (
                <Row
                  key={`${item.sku}-${index}`}
                >
                  <Column
                    style={tableCell}
                  >
                    <div>
                      <strong>
                        {
                          item.productName
                        }
                      </strong>
                    </div>
                    {item.options.map(
                      (
                        option,
                      ) => (
                        <div
                          key={`${option.name}-${option.value}`}
                        >
                          {option.name}
                          :{' '}
                          {
                            option.value
                          }
                        </div>
                      ),
                    )}
                    <div>
                      {`SKU ${item.sku}`}{' '}
                      ·{' '}
                      {`Qtd: ${item.quantity}`}
                    </div>
                  </Column>
                  <Column
                    style={
                      tableCellRight
                    }
                  >
                    {`${formatMoneyCents(item.unitPriceCents)} / unid.`}
                  </Column>
                  <Column
                    style={
                      tableCellRight
                    }
                  >
                    {formatMoneyCents(
                      item.lineTotalCents,
                    )}
                  </Column>
                </Row>
              ),
            )}
          </Section>

          <Text
            style={sectionHeading}
          >
            {isPickup
              ? 'Levantamento na loja'
              : 'Morada de entrega'}
          </Text>

          <Text
            style={
              paragraphWithMargin
            }
          >
            {isPickup
              ? 'Esta encomenda é para levantamento na loja. Irá ser notificado quando estiver pronta para levantamento.'
              : shippingAddress
                ? formatDeliveryAddress(
                    shippingAddress,
                  )
                : 'Morada de entrega não disponível. Consulte os detalhes na sua conta.'}
          </Text>

          <Hr style={divider} />

          <Section style={table}>
            <Row>
              <Column
                style={
                  paragraphWithMargin
                }
              >
                Subtotal
              </Column>
              <Column
                style={
                  tableCellRight
                }
              >
                {formatMoneyCents(
                  subtotalCents,
                )}
              </Column>
            </Row>
            <Row>
              <Column
                style={
                  paragraphWithMargin
                }
              >
                Portes
              </Column>
              <Column
                style={
                  tableCellRight
                }
              >
                {formatMoneyCents(
                  shippingCostCents,
                )}
              </Column>
            </Row>
            <Row>
              <Column
                style={
                  paragraphWithMargin
                }
              >
                IVA incluído
              </Column>
              <Column
                style={
                  tableCellRight
                }
              >
                {formatMoneyCents(
                  taxCents,
                )}
              </Column>
            </Row>
            <Row>
              <Column
                style={
                  totalRowLabel
                }
              >
                Total
              </Column>
              <Column
                style={totalValue}
              >
                {formatMoneyCents(
                  totalCents,
                )}
              </Column>
            </Row>
          </Section>

          <Text style={muted}>
            Pode acompanhar o
            estado da encomenda
            na sua conta em{' '}
            {STORE_NAME}.
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            Recebeu este email
            porque uma encomenda
            foi criada com este
            endereço em{' '}
            {STORE_NAME}. Não
            responda a este email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default OrderConfirmationEmail

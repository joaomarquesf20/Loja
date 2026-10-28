import { NextResponse } from 'next/server'

import {
  type CheckoutInput,
  createCheckoutOrder,
} from '@/server/checkout'
import {
  readJsonBody,
} from '@/server/http-request'
import {
  requireActiveUserId,
} from '@/server/user-auth'
import {
  CHECKOUT_JSON_LIMIT_BYTES,
  handleCheckoutError,
  parseCheckoutRequestBody,
} from './checkout-request'

export async function POST(
  request: Request,
) {
  try {
    const userId =
      await requireActiveUserId()

    const body = await readJsonBody(
      request,
      CHECKOUT_JSON_LIMIT_BYTES,
    )

    const parsed =
      parseCheckoutRequestBody(body)

    if (!parsed.ok) {
      return parsed.response
    }

    const checkoutInput = {
      ...parsed.fulfillment,
      ...parsed.payment,
      couponCode:
        parsed.couponCode,
    } as CheckoutInput

    const order =
      await createCheckoutOrder(
        userId,
        checkoutInput,
        parsed.expectedFingerprint,
      )

    return NextResponse.json(
      {
        order,
      },
      {
        status: 201,
      },
    )
  } catch (error) {
    return handleCheckoutError(
      error,
    )
  }
}

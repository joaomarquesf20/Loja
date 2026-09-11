export type PortugalPostalRegion =
  | 'PORTUGAL_MAINLAND'
  | 'MADEIRA'
  | 'AZORES'

export type PortugalPostalCodeParseResult =
  | {
      valid: true
      postalCode: string
      prefix: number
      region: PortugalPostalRegion
    }
  | {
      valid: false
      postalCode: null
      prefix: null
      region: null
    }

const PORTUGAL_POSTAL_CODE_PATTERN =
  /^(\d{4})-(\d{3})$/

export function parsePortugalPostalCode(
  value: unknown,
): PortugalPostalCodeParseResult {
  if (typeof value !== 'string') {
    return {
      valid: false,
      postalCode: null,
      prefix: null,
      region: null,
    }
  }

  const postalCode = value.trim()

  const match =
    PORTUGAL_POSTAL_CODE_PATTERN.exec(
      postalCode,
    )

  if (!match) {
    return {
      valid: false,
      postalCode: null,
      prefix: null,
      region: null,
    }
  }

  const prefix = Number(match[1])

  if (
    !Number.isSafeInteger(prefix) ||
    prefix < 1000 ||
    prefix > 9999
  ) {
    return {
      valid: false,
      postalCode: null,
      prefix: null,
      region: null,
    }
  }

  if (prefix <= 8999) {
    return {
      valid: true,
      postalCode,
      prefix,
      region:
        'PORTUGAL_MAINLAND',
    }
  }

  if (prefix <= 9499) {
    return {
      valid: true,
      postalCode,
      prefix,
      region: 'MADEIRA',
    }
  }

  return {
    valid: true,
    postalCode,
    prefix,
    region: 'AZORES',
  }
}

export function isPortugalMainlandPostalCode(
  value: unknown,
) {
  const result =
    parsePortugalPostalCode(value)

  return (
    result.valid &&
    result.region ===
      'PORTUGAL_MAINLAND'
  )
}

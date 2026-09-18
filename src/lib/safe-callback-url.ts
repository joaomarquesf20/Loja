export function getSafeCallbackUrl(
  callbackUrl: string | null,
  origin: string,
) {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith('/') ||
    callbackUrl.startsWith('//') ||
    callbackUrl.includes('\\')
  ) {
    return '/'
  }

  try {
    const parsed = new URL(
      callbackUrl,
      origin,
    )

    if (parsed.origin !== origin) {
      return '/'
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/'
  }
}

export function getCallbackHref(
  pathname: string,
  callbackUrl: string,
) {
  if (callbackUrl === '/') {
    return pathname
  }

  return `${pathname}?callbackUrl=${encodeURIComponent(
    callbackUrl,
  )}`
}

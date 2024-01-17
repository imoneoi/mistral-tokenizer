export function decodeBase64(encodedString: string) {
  return atob(encodedString)
}

export function utf8ByteToHex(c: number) {
  const hexValue = c.toString(16).toUpperCase().padStart(2, '0')
  return `<0x${hexValue}>`
}

export function hexToUtf8Byte(hex: string) {
  const strippedHex = hex.replace(/<0x|>/gi, '')
  return parseInt(strippedHex, 16)
}

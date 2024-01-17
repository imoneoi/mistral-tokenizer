import { decodeBase64, hexToUtf8Byte, utf8ByteToHex } from './utils'

describe('decodeBase64', () => {
  it('decodes a base64 encoded string correctly', () => {
    const encoded = btoa('Hello World')
    const decoded = decodeBase64(encoded)
    expect(decoded).toBe('Hello World')
  })

  it('throws an error for invalid base64 string', () => {
    const invalidBase64 = 'Invalid@@Base64'
    expect(() => decodeBase64(invalidBase64)).toThrow()
  })

  it('returns an empty string for empty input', () => {
    const decoded = decodeBase64('')
    expect(decoded).toBe('')
  })
})

describe('utf8ByteToHex', () => {
  it('converts typical byte values to hex correctly', () => {
    expect(utf8ByteToHex(0)).toBe('<0x00>')
    expect(utf8ByteToHex(32)).toBe('<0x20>')
    expect(utf8ByteToHex(127)).toBe('<0x7F>')
  })

  it('handles the lowest byte value (0)', () => {
    expect(utf8ByteToHex(0)).toBe('<0x00>')
  })

  it('handles the highest byte value (255)', () => {
    expect(utf8ByteToHex(255)).toBe('<0xFF>')
  })
})

describe('hexToUtf8Byte', () => {
  it('converts valid hexadecimal strings to bytes correctly', () => {
    expect(hexToUtf8Byte('<0x00>')).toBe(0)
    expect(hexToUtf8Byte('<0x1F>')).toBe(31)
    expect(hexToUtf8Byte('<0xFF>')).toBe(255)
  })

  it('handles invalid hexadecimal strings', () => {
    expect(hexToUtf8Byte('not a hex string')).toBeNaN()
    expect(hexToUtf8Byte('<0xG1>')).toBeNaN()
  })

  it('handles hex strings outside the byte range', () => {
    expect(hexToUtf8Byte('<0x100>')).toBe(256)
    expect(hexToUtf8Byte('<0x10FFFF>')).toBe(1114111)
  })

  it('handles empty inputs', () => {
    expect(hexToUtf8Byte('')).toBeNaN()
  })

  it('is case insensitive', () => {
    expect(hexToUtf8Byte('<0XaB>')).toBe(171)
    expect(hexToUtf8Byte('<0XAB>')).toBe(171)
  })
})

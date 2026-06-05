const { isSupported, getRate } = require('../exchangerate')

describe('exchangerate util functions', () => {
  test('isSupported recognizes ETB and known currencies', () => {
    expect(isSupported('ETB')).toBe(true)
    expect(isSupported('USD')).toBe(true)
    expect(isSupported('eur')).toBe(false) // lowercase should be false because function expects exact or ETB special-case
  })

  test('getRate returns 1 for same currency', () => {
    expect(getRate('USD', 'USD')).toBe(1)
    expect(getRate('etb', 'ETB')).toBe(1)
  })

  test('getRate ETB -> USD and USD -> ETB and USD -> EUR', () => {
    const usdRate = getRate('ETB', 'USD')
    expect(usdRate).toBeCloseTo(0.017, 9)

    const etbFromUsd = getRate('USD', 'ETB')
    expect(etbFromUsd).toBeCloseTo(1 / 0.017, 9)

    const usdToEur = getRate('USD', 'EUR')
    // USD -> EUR via ETB: (1 / USD_rate) * EUR_rate
    const expected = (1 / 0.017) * 0.016
    expect(usdToEur).toBeCloseTo(expected, 9)
  })

  test('getRate returns null for unsupported conversion', () => {
    expect(getRate('ABC', 'XYZ')).toBeNull()
  })
})

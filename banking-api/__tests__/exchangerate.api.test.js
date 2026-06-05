const request = require('supertest')
const { app, API_KEY } = require('../exchangerate')

describe('Exchange API endpoints', () => {
  const authHeader = { 'api-key': API_KEY }

  test('GET /api/health returns OK', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'OK')
    expect(res.body).toHaveProperty('message')
  })

  test('GET /api/rates requires API key', async () => {
    const res = await request(app).get('/api/rates')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('status', 'ERROR')
  })

  test('GET /api/rates returns ETB base when authenticated', async () => {
    const res = await request(app).get('/api/rates').set(authHeader)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body.data).toHaveProperty('baseCurrency', 'ETB')
    expect(res.body.data).toHaveProperty('rates')
    expect(res.body.data.rates).toHaveProperty('USD')
  })

  test('POST /api/convert validates inputs and converts', async () => {
    // missing fields
    let res = await request(app).post('/api/convert').set(authHeader).send({ from: 'ETB' })
    expect(res.status).toBe(400)

    // invalid amount
    res = await request(app).post('/api/convert').set(authHeader).send({ from: 'ETB', to: 'USD', amount: -5 })
    expect(res.status).toBe(400)

    // unsupported currency
    res = await request(app).post('/api/convert').set(authHeader).send({ from: 'ABC', to: 'USD', amount: 10 })
    expect(res.status).toBe(404)

    // successful conversion ETB -> USD
    res = await request(app).post('/api/convert').set(authHeader).send({ from: 'ETB', to: 'USD', amount: 100 })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body.data).toMatchObject({ from: 'ETB', to: 'USD', amount: 100 })
    expect(res.body.data).toHaveProperty('rate')
    expect(res.body.data).toHaveProperty('converted')
    expect(res.body.data.converted).toBeCloseTo(100 * res.body.data.rate, 2)
  })

  test('GET /api/convert-all works and validates', async () => {
    // missing base
    let res = await request(app).get('/api/convert-all').set(authHeader)
    expect(res.status).toBe(400)

    // unsupported base
    res = await request(app).get('/api/convert-all').set(authHeader).query({ base: 'ABC' })
    expect(res.status).toBe(404)

    // invalid amount
    res = await request(app).get('/api/convert-all').set(authHeader).query({ base: 'ETB', amount: -1 })
    expect(res.status).toBe(400)

    // success
    res = await request(app).get('/api/convert-all').set(authHeader).query({ base: 'USD', amount: 100 })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('baseCurrency', 'USD')
    expect(res.body.data).toHaveProperty('conversions')
    expect(Array.isArray(res.body.data.conversions)).toBe(true)
    // conversions should not include base
    expect(res.body.data.conversions.some(c => c.currency === 'USD')).toBe(false)
  })
})

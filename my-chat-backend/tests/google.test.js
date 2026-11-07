const { after, beforeEach, mock, test } = require('node:test')
const assert = require('node:assert/strict')
const { createHash, generateKeyPairSync } = require('node:crypto')
const vm = require('node:vm')
const mongoose = require('mongoose')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

require('dotenv').config()
if (!process.env.TEST_MONGODB_URI) throw new Error('Google tests require a separate TEST_MONGODB_URI')
process.env.GOOGLE_CLIENT_ID = 'test-google-client'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret'
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback'
process.env.FRONTEND_URL = 'http://localhost:5173'

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
let nonce
let challenge
let tokenMode
let profileName
let tokenRequests = 0
const authorizations = new Map()
mock.method(globalThis, 'fetch', async (input, options) => {
  const url = String(input)
  const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
  if (url === 'https://accounts.google.com/.well-known/openid-configuration') {
    return json({
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
      response_types_supported: ['code'], subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256']
    })
  }
  if (url === 'https://www.googleapis.com/oauth2/v3/certs') {
    return json({ keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }] })
  }
  if (url === 'https://oauth2.googleapis.com/token') {
    tokenRequests += 1
    const body = new URLSearchParams(options.body)
    assert.equal(body.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI)
    assert.equal(body.get('client_id'), 'test-google-client')
    assert.equal(body.get('client_secret'), 'test-google-secret')
    const requestedChallenge = createHash('sha256').update(body.get('code_verifier')).digest('base64url')
    assert(authorizations.has(requestedChallenge), 'token exchange must use the PKCE verifier from its login transaction')
    if (tokenMode === 'unavailable') return new Response('Unavailable', { status: 503 })
    const claims = {
      sub: 'stable-google-subject', name: profileName,
      nonce: tokenMode === 'nonce' ? 'wrong-nonce' : authorizations.get(requestedChallenge)
    }
    const idToken = jwt.sign(claims, tokenMode === 'signature' ? otherKeys.privateKey : keys.privateKey, {
      algorithm: 'RS256', keyid: 'test-key',
      issuer: tokenMode === 'issuer' ? 'https://untrusted.example' : 'https://accounts.google.com',
      audience: tokenMode === 'audience' ? 'another-client' : 'test-google-client',
      expiresIn: tokenMode === 'expired' ? -60 : 300
    })
    return json({ access_token: 'provider-access-token', token_type: 'Bearer',
      ...(tokenMode === 'missing' ? {} : { id_token: idToken }) })
  }
  throw new Error(`Unexpected provider request: ${url}`)
})

const app = require('../app')
const User = require('../models/user')
app.set('trust proxy', 1)
let api
let clientNumber = 0
const attempts = () => mongoose.connection.collection('oidclogins')
const digest = value => createHash('sha256').update(value).digest('hex')

const popupResult = response => {
  const script = response.text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]
  assert(script, 'callback must return its popup response script')
  let result
  vm.runInNewContext(script, { window: {
    opener: { postMessage: (value, origin) => { result = JSON.parse(JSON.stringify(value)); assert.equal(origin, 'http://localhost:5173') } },
    close() {}
  } })
  return result
}

async function start(agent = api) {
  const response = await agent.get('/api/auth/google').expect(302)
  const location = new URL(response.headers.location)
  nonce = location.searchParams.get('nonce')
  challenge = location.searchParams.get('code_challenge')
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('response_type'), 'code')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(location.searchParams.get('scope'), 'openid profile')
  assert(nonce && challenge)
  authorizations.set(challenge, nonce)
  assert(response.headers['set-cookie'][0].includes('HttpOnly'))
  assert(response.headers['set-cookie'][0].includes('SameSite=Lax'))
  return location.searchParams.get('state')
}

beforeEach(async () => {
  await mongoose.connection.asPromise()
  await User.init()
  await User.deleteMany({})
  await attempts().deleteMany({})
  api = supertest.agent(app).set('X-Forwarded-For', `192.0.2.${++clientNumber}`)
  tokenMode = 'valid'
  profileName = 'Google Person'
  tokenRequests = 0
  authorizations.clear()
})
after(async () => { await mongoose.connection.close() })

test('Google sign-in exchanges a PKCE code for a usable app session and reuses the same identity', async () => {
  const config = await api.get('/api/auth/google/config').expect(200)
  assert.deepEqual(config.body, { enabled: true })
  const state = await start()
  const response = await api.get('/api/auth/google/callback').query({ state, code: 'test-code' }).expect(200)
  const result = popupResult(response)
  assert.equal(result.type, 'chat:google-login')
  assert.equal(result.user.name, 'Google Person')
  assert.equal(jwt.verify(result.user.token, process.env.SECRET).id, result.user.id)
  assert.equal(result.user.googleSub, undefined)
  assert.equal(tokenRequests, 1)
  await api.get('/api/users').set('Authorization', `Bearer ${result.user.token}`).expect(200)
  const stored = await User.findById(result.user.id)
  assert.equal(stored.googleSub, 'stable-google-subject')
  assert.equal(stored.passwordHash, undefined)

  const again = await start()
  const second = popupResult(await api.get('/api/auth/google/callback').query({ state: again, code: 'second-code' }).expect(200))
  assert.equal(second.user.id, result.user.id)
  assert.equal(await User.countDocuments({}), 1)
})

test('missing browser cookie, wrong state, expired transactions, and replay cannot create a session', async () => {
  const state = await start()
  const missing = await supertest(app).get('/api/auth/google/callback').query({ state, code: 'test-code' })
  assert(popupResult(missing).error)
  const wrong = await api.get('/api/auth/google/callback').query({ state: 'wrong-state', code: 'test-code' })
  assert(popupResult(wrong).error)
  assert.equal(tokenRequests, 0)
  assert.equal(await User.countDocuments({}), 0)

  const expired = await start()
  await attempts().updateOne({ stateHash: digest(expired) }, { $set: { expiresAt: new Date(0) } })
  assert(popupResult(await api.get('/api/auth/google/callback').query({ state: expired, code: 'expired-code' })).error)
  const valid = await start()
  const callback = { state: valid, code: 'valid-code' }
  assert(popupResult(await api.get('/api/auth/google/callback').query(callback)).user)
  assert(popupResult(await api.get('/api/auth/google/callback').query(callback)).error)
  assert.equal(tokenRequests, 1)
})

for (const mode of ['nonce', 'issuer', 'audience', 'signature', 'expired', 'missing', 'unavailable']) {
  test(`Google sign-in rejects ${mode} provider responses`, async () => {
    tokenMode = mode
    const state = await start()
    const result = popupResult(await api.get('/api/auth/google/callback').query({ state, code: 'bad-response' }))
    assert(result.error)
    assert.equal(result.user, undefined)
    assert.equal(await User.countDocuments({}), 0)
  })
}

test('provider cancellation and HTML-like profile names are handled without exposing executable profile text', async () => {
  const cancelled = await start()
  assert(popupResult(await api.get('/api/auth/google/callback').query({ state: cancelled, error: 'access_denied' })).error)
  assert.equal(tokenRequests, 0)
  profileName = '</script><script>untrusted()</script>'
  const state = await start()
  const response = await api.get('/api/auth/google/callback').query({ state, code: 'valid' })
  assert.equal(popupResult(response).user.name, profileName)
  assert.equal(response.text.includes('</script><script>'), false)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert(response.headers['content-security-policy'].includes('script-src'))
})

test('Google-only profiles cannot use password login and provider IDs cannot be injected through registration', async () => {
  const state = await start()
  const result = popupResult(await api.get('/api/auth/google/callback').query({ state, code: 'valid' }))
  await api.post('/api/login').send({ username: result.user.username, password: 'guess' }).expect(401)
  await api.post('/api/users').send({ username: 'local-user', name: 'Local', password: 'secret123', googleSub: 'injected' }).expect(201)
  assert.equal((await User.findOne({ username: 'local-user' })).googleSub, undefined)
})

test('concurrent Google logins for the same identity resolve to one app profile', async () => {
  const secondBrowser = supertest.agent(app).set('X-Forwarded-For', '198.51.100.99')
  const firstState = await start()
  const secondState = await start(secondBrowser)
  const responses = await Promise.all([
    api.get('/api/auth/google/callback').query({ state: firstState, code: 'first-browser' }),
    secondBrowser.get('/api/auth/google/callback').query({ state: secondState, code: 'second-browser' })
  ])
  assert.equal(popupResult(responses[0]).user.id, popupResult(responses[1]).user.id)
  assert.equal(await User.countDocuments({}), 1)
})

test('production login transactions use a Secure host-prefixed cookie', async () => {
  const config = require('../utils/config')
  const previous = config.GOOGLE_REDIRECT_URI
  try {
    config.GOOGLE_REDIRECT_URI = 'https://backend.example/api/auth/google/callback'
    const response = await api.get('/api/auth/google').expect(302)
    const cookie = response.headers['set-cookie'][0]
    assert(cookie.startsWith('__Host-chat-google='))
    assert(cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('Path=/'))
  } finally {
    config.GOOGLE_REDIRECT_URI = previous
  }
})

test('callback logs omit authorization codes even for case-insensitive route matches', async () => {
  const state = await start()
  let output = ''
  const originalWrite = process.stdout.write
  const capture = mock.method(process.stdout, 'write', function (...args) {
    output += String(args[0])
    return originalWrite.apply(this, args)
  })
  try {
    const response = await api.get('/API/AUTH/GOOGLE/CALLBACK').query({ state, code: 'private-callback-code' })
    assert(popupResult(response).user)
    assert.equal(output.includes('private-callback-code'), false)
  } finally {
    capture.mock.restore()
  }
})

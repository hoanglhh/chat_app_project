const router = require('express').Router()
const { createHash, randomBytes } = require('node:crypto')
const { rateLimit } = require('express-rate-limit')
const google = require('../services/google')
const OidcLogin = require('../models/oidcLogin')
const User = require('../models/user')
const loginResponse = require('../utils/loginResponse')
const logger = require('../utils/logger')
const hashState = state => createHash('sha256').update(state).digest('hex')

const popupResponse = (res, result) => {
  const nonce = randomBytes(24).toString('base64')
  const payload = JSON.stringify({ type: 'chat:google-login', ...result }).replace(/</g, '\\u003c')
  const origin = JSON.stringify(google.settings().frontendOrigin)
  res.set({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`
  }).type('html').send(`<!doctype html><title>Google sign-in</title><p>Return to the chat application.</p>
    <script nonce="${nonce}">window.opener?.postMessage(${payload}, ${origin}); window.close();</script>`)
}

router.get('/google/config', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ enabled: google.isConfigured() })
})

router.use('/google', (req, res, next) => {
  if (!google.isConfigured()) return res.status(503).json({ error: 'Google sign-in is not available' })
  next()
}, rateLimit({
  windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (req, res) => popupResponse(res.status(429), { error: 'Too many Google sign-in attempts. Please try again in 15 minutes.' })
}))

const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: google.settings().secure, path: '/' })
const cookieName = () => google.settings().secure ? '__Host-chat-google' : 'chat-google'

router.get('/google', async (req, res) => {
  try {
    const request = await google.createAuthorizationRequest()
    await OidcLogin.create({ stateHash: hashState(request.state), codeVerifier: request.codeVerifier,
      nonce: request.nonce, expiresAt: new Date(Date.now() + 10 * 60 * 1000) })
    res.cookie(cookieName(), request.state, { ...cookieOptions(), maxAge: 10 * 60 * 1000 })
    res.set('Cache-Control', 'no-store').redirect(request.url)
  } catch (error) {
    logger.error('Google sign-in could not start:', error.message)
    popupResponse(res, { error: 'Google sign-in is unavailable. Please try again.' })
  }
})

router.get('/google/callback', async (req, res) => {
  const name = cookieName()
  const cookie = req.headers.cookie?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1)
  res.clearCookie(name, cookieOptions())

  try {
    const state = req.query.state
    if (typeof state !== 'string' || !cookie || cookie !== state) throw new Error('Invalid login state')
    const transaction = await OidcLogin.findOneAndDelete({ stateHash: hashState(state), expiresAt: { $gt: new Date() } })
    if (!transaction) throw new Error('Expired or consumed login state')
    if (req.query.error === 'access_denied') return popupResponse(res, { error: 'Google sign-in was cancelled.' })
    const url = new URL(google.settings().redirectUri)
    url.search = new URL(req.originalUrl, 'http://localhost').search
    const claims = await google.getClaims(url, { ...transaction.toObject(), state })
    if (typeof claims?.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new Error('Invalid Google identity')
    const name = typeof claims.name === 'string' ? claims.name.trim().slice(0, 100) : ''
    let user
    await User.init()
    try {
      user = await User.findOneAndUpdate({ googleSub: claims.sub }, { $setOnInsert: {
        username: `google_${randomBytes(12).toString('hex')}`, name: name || 'Google user'
      } }, { upsert: true, returnDocument: 'after', runValidators: true })
    } catch (error) {
      if (error.code !== 11000) throw error
      user = await User.findOne({ googleSub: claims.sub })
      if (!user) throw error
    }
    popupResponse(res, { user: loginResponse(user) })
  } catch (error) {
    logger.error('Google sign-in failed:', error.message)
    popupResponse(res, { error: 'Google sign-in could not be verified. Please try again.' })
  }
})

module.exports = router

const config = require('../utils/config')
let configuration

const settings = () => {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI || !config.FRONTEND_URL) {
    throw new Error('Google sign-in is not configured')
  }
  const callback = new URL(config.GOOGLE_REDIRECT_URI)
  const frontend = new URL(config.FRONTEND_URL)
  for (const url of [callback, frontend]) {
    if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new Error('Google sign-in requires HTTPS or a local development URL')
    }
  }
  if (callback.pathname !== '/api/auth/google/callback') throw new Error('Invalid Google callback path')
  return { redirectUri: callback.href, frontendOrigin: frontend.origin, secure: callback.protocol === 'https:' }
}

const isConfigured = () => {
  try { settings(); return true } catch { return false }
}

const getConfiguration = async () => {
  if (!configuration) {
    configuration = import('openid-client').then(async client => {
      const discovered = await client.discovery(
        new URL('https://accounts.google.com'), config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET
      )
      client.enableNonRepudiationChecks(discovered)
      return discovered
    }).catch(error => { configuration = undefined; throw error })
  }
  return configuration
}

const createAuthorizationRequest = async () => {
  const client = await import('openid-client')
  const codeVerifier = client.randomPKCECodeVerifier()
  const state = client.randomState()
  const nonce = client.randomNonce()
  const url = client.buildAuthorizationUrl(await getConfiguration(), {
    redirect_uri: settings().redirectUri,
    scope: 'openid profile',
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256', state, nonce
  })
  return { url: url.href, state, nonce, codeVerifier }
}

const getClaims = async (url, transaction) => {
  const client = await import('openid-client')
  const tokens = await client.authorizationCodeGrant(await getConfiguration(), url, {
    pkceCodeVerifier: transaction.codeVerifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    idTokenExpected: true
  })
  return tokens.claims()
}

module.exports = { settings, isConfigured, createAuthorizationRequest, getClaims }

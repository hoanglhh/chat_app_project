const { rateLimit } = require('express-rate-limit')

// shortcut: limits are per process; use a shared store before running multiple instances.
const options = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}

const loginLimiter = rateLimit({
  ...options,
  limit: 20,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
})

const registrationLimiter = rateLimit({
  ...options,
  limit: 30,
  message: { error: 'Too many registration requests. Please try again in 15 minutes.' }
})

module.exports = { loginLimiter, registrationLimiter }

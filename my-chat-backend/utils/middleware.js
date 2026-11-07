const logger = require('./logger')
const jwt = require('jsonwebtoken')
const config = require('./config')

const getTokenFrom = req => {
  const authorization = req.get('authorization')
  return authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null
}

const authenticateUser = (req, res, next) => {
  try {
    const decodedToken = jwt.verify(getTokenFrom(req), config.SECRET)

    if (!decodedToken.id) {
      return res.status(401).json({ error: 'token invalid' })
    }

    req.decodedToken = decodedToken
    next()
  } catch (error) {
    next(error)
  }
}

const unknownEndpoint = (req, res) => {
  res.status(404).json({
    error: 'unknown endpoint'
  })
}

const errorHandler = (error, req, res, next) => {
  logger.error(error.message)

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'malformed JSON'
    })
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      error: 'malformatted id'
    })
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message
    })
  }

  if (error.code === 11000) {
    return res.status(400).json({
      error: 'username must be unique'
    })
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'token expired'
    })
  }

  if (error.name ===  'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'token invalid' 
    })
  }

  next(error)
}

module.exports = { getTokenFrom, authenticateUser, unknownEndpoint, errorHandler }

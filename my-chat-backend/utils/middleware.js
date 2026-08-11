const logger = require('./logger')

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

module.exports = { unknownEndpoint, errorHandler}
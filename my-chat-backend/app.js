const express = require('express')
const app = express()
const cors = require('cors')
const morgan = require('morgan')
const usersRouter = require('./controllers/users')
const loginRouter = require('./controllers/login')
const mongoose = require('mongoose')
const middleware = require('./utils/middleware')
const config = require('./utils/config')
const logger = require('./utils/logger')
const conversationsRouter = require('./controllers/conversations')
const googleRouter = require('./controllers/google')

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1)
}

logger.info('connecting to MongoDB')

mongoose.connect(config.MONGODB_URI, { family: 4 })
  .then(() => {
    logger.info('connected to MongoDB')
  })
  .catch(error => {
    logger.error('error connecting to MongoDB:', error.message)
  })

app.use(cors())
app.use(express.json())
app.use(morgan('tiny', { skip: req => req.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase() === '/api/auth/google/callback' }))

app.use('/api/users', usersRouter)
app.use('/api/login', loginRouter)
app.use('/api/auth', googleRouter)
app.use('/api/conversations', conversationsRouter)

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app

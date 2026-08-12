const { createServer } = require('node:http')
const { Server } = require('socket.io')

const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')

const server = createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

app.set('io', io)

io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`)

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`)
  })
})

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`)
})


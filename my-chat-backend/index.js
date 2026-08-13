const { createServer } = require('node:http')
const { Server } = require('socket.io')

const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')
const jwt = require('jsonwebtoken')
const Conversation = require('./models/conversation')

const server = createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

app.set('io', io)

io.use((socket, next) => {
  try {
    const decodedToken = jwt.verify(
      socket.handshake.auth.token,
      config.SECRET
    )

    if (!decodedToken.id) {
      return next(new Error('authentication error'))
    }

    socket.userId = decodedToken.id
    next()
  } catch {
    next(new Error('authentication error'))
  }
})

io.on('connection', socket => {
  logger.info(`Socket connected: ${socket.id}`)

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`)
  })

  socket.on(
    'conversation:join',
    async (conversationId, acknowledge) => {
      try {
        const conversation = await Conversation.findById(conversationId)

        if (!conversation) {
          return acknowledge?.({
            error: 'conversation not found'
          })
        }

        const isParticipant = conversation.participants.some(
          participantId =>
            participantId.toString() === socket.userId
        )

        if (!isParticipant) {
          return acknowledge?.({
            error: 'not allowed to join this conversation'
          })
        }

        await socket.join(conversationId)
        acknowledge?.({ success: true })
      } catch {
        acknowledge?.({
          error: 'failed to join conversation'
        })
      }
    }
  )

  socket.on('conversation:leave', conversationId => {
    socket.leave(conversationId)
  })
})

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`)
})


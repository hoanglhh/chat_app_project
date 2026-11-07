const { createServer } = require('node:http')
const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')
const createSocketServer = require('./socket')

const server = createServer(app)

const io = createSocketServer(server)

app.set('io', io)

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`)
})

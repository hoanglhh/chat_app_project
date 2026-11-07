const { after, afterEach, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const { createServer } = require('node:http')
const { once } = require('node:events')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const supertest = require('supertest')
const { io } = require('socket.io-client')

require('dotenv').config()
if (!process.env.TEST_MONGODB_URI) {
  throw new Error('TEST_MONGODB_URI is required. Socket tests delete their database contents.')
}

const app = require('../app')
const createSocketServer = require('../socket')
const User = require('../models/user')
const Message = require('../models/message')
const Conversation = require('../models/conversation')
const server = createServer(app)
const socketServer = createSocketServer(server)
app.set('io', socketServer)
const clients = new Set()
let api
let baseUrl
let alice
let bob

const event = (socket, name) => once(socket, name, { signal: AbortSignal.timeout(5000) })

async function connect(username) {
  const login = await api.post('/api/login').send({ username, password: 'secret123' }).expect(200)
  const socket = io(baseUrl, {
    autoConnect: false,
    auth: { token: login.body.token },
    transports: ['websocket'],
    reconnection: false
  })
  clients.add(socket)
  const connected = event(socket, 'connect')
  socket.connect()
  await connected
  return { socket, token: login.body.token }
}

before(async () => {
  await mongoose.connection.asPromise()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  api = supertest(baseUrl)
})

beforeEach(async () => {
  await Message.deleteMany({})
  await Conversation.deleteMany({})
  await User.deleteMany({})
  const passwordHash = await bcrypt.hash('secret123', 4)
  alice = await User.create({ username: 'alice', name: 'Alice', passwordHash })
  bob = await User.create({ username: 'bob', name: 'Bob', passwordHash })
  await User.create({ username: 'charlie', name: 'Charlie', passwordHash })
})

afterEach(() => {
  clients.forEach(socket => socket.disconnect())
  clients.clear()
})

after(async () => {
  await new Promise(resolve => socketServer.close(resolve))
  await mongoose.connection.close()
})

test('two clients receive conversation and message changes while an outsider cannot join', async () => {
  const sender = await connect('alice')
  const recipient = await connect('bob')
  const outsider = await connect('charlie')

  const createdEvent = event(recipient.socket, 'conversation:created')
  const created = await api.post('/api/conversations')
    .set('Authorization', `Bearer ${sender.token}`)
    .send({ participantId: bob.id.toUpperCase() }).expect(201)
  assert.equal((await createdEvent)[0].id, created.body.id)
  assert.equal((await sender.socket.timeout(5000).emitWithAck('conversation:join', created.body.id)).success, true)
  assert.equal((await recipient.socket.timeout(5000).emitWithAck('conversation:join', created.body.id)).success, true)
  assert.match((await outsider.socket.timeout(5000).emitWithAck('conversation:join', created.body.id)).error, /not allowed/)

  const url = `/api/conversations/${created.body.id}/messages`
  const received = [event(sender.socket, 'message:created'), event(recipient.socket, 'message:created')]
  const sent = await api.post(url).set('Authorization', `Bearer ${sender.token}`)
    .send({ content: 'Delivered to both clients' }).expect(201)
  for (const [message] of await Promise.all(received)) {
    assert.equal(message.id, sent.body.id)
    assert.equal(message.user, alice.id)
    assert.equal(message.content, 'Delivered to both clients')
  }

  const editedEvents = [event(sender.socket, 'message:updated'), event(recipient.socket, 'message:updated')]
  await api.put(`${url}/${sent.body.id}`).set('Authorization', `Bearer ${sender.token}`)
    .send({ content: 'Edited for both clients' }).expect(200)
  for (const [message] of await Promise.all(editedEvents)) assert.equal(message.content, 'Edited for both clients')

  const deletedEvents = [event(sender.socket, 'message:deleted'), event(recipient.socket, 'message:deleted')]
  await api.delete(`${url}/${sent.body.id}`).set('Authorization', `Bearer ${sender.token}`).expect(204)
  for (const [id] of await Promise.all(deletedEvents)) assert.equal(id, sent.body.id)
  assert.equal(await Message.countDocuments({}), 0)
})

test('a socket with an invalid token cannot connect', async () => {
  const socket = io(baseUrl, { autoConnect: false, auth: { token: 'invalid' }, reconnection: false })
  clients.add(socket)
  const rejected = event(socket, 'connect_error')
  socket.connect()
  assert.match((await rejected)[0].message, /authentication error/)
  assert.equal(socket.connected, false)
})

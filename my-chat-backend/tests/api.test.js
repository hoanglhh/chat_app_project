const { after, beforeEach, describe, test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const supertest = require('supertest')

require('dotenv').config()

if (!process.env.TEST_MONGODB_URI) {
  throw new Error(
    'TEST_MONGODB_URI is required. Use a separate database because tests delete its data.'
  )
}

const app = require('../app')
const Conversation = require('../models/conversation')
const Message = require('../models/message')
const User = require('../models/user')

const api = supertest(app)
const emittedEvents = []

app.set('io', {
  to: room => ({
    emit: (event, payload) => {
      emittedEvents.push({ room, event, payload })
    }
  })
})

let alice
let bob
let charlie
let conversation

const loginAs = async (username, password = 'secret123') => {
  const response = await api
    .post('/api/login')
    .send({ username, password })
    .expect(200)

  return response.body.token
}

const createMessageAs = async (
  token,
  conversationId = conversation.id,
  content = 'Hello from Alice'
) => {
  return api
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content })
    .expect(201)
}

beforeEach(async () => {
  await mongoose.connection.asPromise()
  await Message.deleteMany({})
  await Conversation.deleteMany({})
  await User.deleteMany({})

  const passwordHash = await bcrypt.hash('secret123', 4)

  alice = await new User({
    username: 'alice',
    name: 'Alice',
    passwordHash
  }).save()

  bob = await new User({
    username: 'bob',
    name: 'Bob',
    passwordHash
  }).save()

  charlie = await new User({
    username: 'charlie',
    name: 'Charlie',
    passwordHash
  }).save()

  conversation = await new Conversation({
    type: 'direct',
    participants: [alice._id, bob._id],
    createdBy: alice._id
  }).save()

  emittedEvents.length = 0
})

describe('users and login', () => {
  test('a valid user can register and the password hash is not returned', async () => {
    const response = await api
      .post('/api/users')
      .send({
        username: 'dave',
        name: 'Dave',
        password: 'secret123'
      })
      .expect(201)
      .expect('Content-Type', /application\/json/)

    assert.equal(response.body.username, 'dave')
    assert.equal(response.body.passwordHash, undefined)
    assert.equal(await User.countDocuments({}), 4)
  })

  test('duplicate usernames are rejected', async () => {
    const response = await api
      .post('/api/users')
      .send({
        username: 'alice',
        name: 'Another Alice',
        password: 'secret123'
      })
      .expect(400)

    assert.equal(response.body.error, 'username must be unique')
  })

  test('registration requires a name', async () => {
    const response = await api
      .post('/api/users')
      .send({
        username: 'eve',
        name: '   ',
        password: 'secret123'
      })
      .expect(400)

    assert.equal(response.body.error, 'name, username and password are required')
    assert.equal(await User.countDocuments({}), 3)
  })

  test('valid credentials return a token and user id', async () => {
    const response = await api
      .post('/api/login')
      .send({ username: 'alice', password: 'secret123' })
      .expect(200)

    assert.equal(typeof response.body.token, 'string')
    assert.equal(response.body.id, alice.id)
    assert.equal(response.body.name, 'Alice')
  })

  test('invalid credentials are rejected', async () => {
    await api
      .post('/api/login')
      .send({ username: 'alice', password: 'wrong-password' })
      .expect(401)
  })
})

describe('direct conversations', () => {
  test('a user can list only conversations they participate in', async () => {
    const aliceToken = await loginAs('alice')

    const response = await api
      .get('/api/conversations')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200)

    assert.equal(response.body.length, 1)
    assert.equal(response.body[0].id, conversation.id)
    assert.equal(response.body[0].participants.length, 2)
  })

  test('creating the same direct conversation returns the existing one', async () => {
    const aliceToken = await loginAs('alice')

    const response = await api
      .post('/api/conversations')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ participantId: bob.id })
      .expect(200)

    assert.equal(response.body.id, conversation.id)
    assert.equal(await Conversation.countDocuments({}), 1)
  })

  test('a user can create a named group conversation', async () => {
    const aliceToken = await loginAs('alice')

    const response = await api
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name: 'Study group',
        participantIds: [bob.id, charlie.id]
      })
      .expect(201)

    assert.equal(response.body.type, 'group')
    assert.equal(response.body.name, 'Study group')
    assert.equal(response.body.createdBy, alice.id)
    assert.equal(response.body.participants.length, 3)
    assert.deepEqual(
      response.body.participants
        .map(participant => participant.username)
        .sort(),
      ['alice', 'bob', 'charlie']
    )
    assert.equal(emittedEvents.length, 2)
    assert.deepEqual(
      emittedEvents.map(event => event.room).sort(),
      [`user:${bob.id}`, `user:${charlie.id}`].sort()
    )
    emittedEvents.forEach(event => {
      assert.equal(event.event, 'conversation:created')
      assert.equal(event.payload.id, response.body.id)
    })
  })

  test('creating a group requires a name and two other members', async () => {
    const aliceToken = await loginAs('alice')

    await api
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: '   ', participantIds: [bob.id, charlie.id] })
      .expect(400)

    await api
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Empty group', participantIds: [] })
      .expect(400)

    await api
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Too small', participantIds: [bob.id] })
      .expect(400)
  })

  test('a group member can invite another user', async () => {
    const passwordHash = await bcrypt.hash('secret123', 4)
    const dave = await new User({
      username: 'dave',
      name: 'Dave',
      passwordHash
    }).save()
    const bobToken = await loginAs('bob')
    const group = await new Conversation({
      type: 'group',
      name: 'Study group',
      participants: [alice._id, bob._id, charlie._id],
      createdBy: alice._id
    }).save()

    emittedEvents.length = 0

    const response = await api
      .post(`/api/conversations/${group.id}/participants`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ participantIds: [dave.id] })
      .expect(200)

    assert.equal(response.body.participants.length, 4)
    assert.deepEqual(
      response.body.participants
        .map(participant => participant.username)
        .sort(),
      ['alice', 'bob', 'charlie', 'dave']
    )
    assert.deepEqual(
      emittedEvents.map(event => event.room).sort(),
      [alice, bob, charlie, dave]
        .map(participant => `user:${participant.id}`)
        .sort()
    )
    emittedEvents.forEach(event => {
      assert.equal(event.event, 'conversation:updated')
      assert.equal(event.payload.id, group.id)
    })
  })

  test('a user outside a group cannot invite members', async () => {
    const outsiderToken = await loginAs('charlie')
    const group = await new Conversation({
      type: 'group',
      name: 'Private group',
      participants: [alice._id, bob._id],
      createdBy: alice._id
    }).save()

    await api
      .post(`/api/conversations/${group.id}/participants`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ participantIds: [charlie.id] })
      .expect(403)
  })

  test('conversation summaries are limited per authenticated user', async () => {
    const aliceToken = await loginAs('alice')
    const summaryUrl = `/api/conversations/${conversation.id}/summary`

    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      const response = await api
        .post(summaryUrl)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200)

      assert.equal(
        response.body.summary,
        'There are no messages to summarize yet.'
      )
    }

    const response = await api
      .post(summaryUrl)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(429)

    assert.equal(
      response.body.error,
      'Too many summary requests. Please try again in 10 minutes.'
    )
  })
})

describe('conversation-scoped messages', () => {
  test('creating a message requires a token', async () => {
    await api
      .post(`/api/conversations/${conversation.id}/messages`)
      .send({ content: 'This must fail' })
      .expect(401)

    assert.equal(await Message.countDocuments({}), 0)
  })

  test('a participant can create and load a message', async () => {
    const aliceToken = await loginAs('alice')
    const response = await createMessageAs(aliceToken)

    assert.equal(response.body.content, 'Hello from Alice')
    assert.equal(response.body.name, 'Alice')
    assert.equal(response.body.user, alice.id)
    assert.equal(response.body.conversation, conversation.id)

    const savedUser = await User.findById(alice.id)
    assert.equal(savedUser.messages[0].toString(), response.body.id)

    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].room, conversation.id)
    assert.equal(emittedEvents[0].event, 'message:created')
    assert.equal(emittedEvents[0].payload.id, response.body.id)

    const messages = await api
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200)

    assert.equal(messages.body.length, 1)
    assert.equal(messages.body[0].id, response.body.id)
  })

  test('a user outside the conversation cannot read or create messages', async () => {
    const charlieToken = await loginAs('charlie')

    await api
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${charlieToken}`)
      .expect(403)

    await api
      .post(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${charlieToken}`)
      .send({ content: 'Charlie must not send this' })
      .expect(403)

    assert.equal(await Message.countDocuments({}), 0)
  })

  test('only the owner can edit a message', async () => {
    const aliceToken = await loginAs('alice')
    const bobToken = await loginAs('bob')
    const created = await createMessageAs(aliceToken)

    emittedEvents.length = 0

    await api
      .put(`/api/conversations/${conversation.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ content: 'Bob tried to edit this' })
      .expect(403)

    const response = await api
      .put(`/api/conversations/${conversation.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ content: 'Alice edited this' })
      .expect(200)

    assert.equal(response.body.content, 'Alice edited this')
    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].room, conversation.id)
    assert.equal(emittedEvents[0].event, 'message:updated')
    assert.equal(emittedEvents[0].payload.id, created.body.id)
  })

  test('only the owner can delete a message', async () => {
    const aliceToken = await loginAs('alice')
    const bobToken = await loginAs('bob')
    const created = await createMessageAs(aliceToken)

    emittedEvents.length = 0

    await api
      .delete(`/api/conversations/${conversation.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403)

    assert.notEqual(await Message.findById(created.body.id), null)

    await api
      .delete(`/api/conversations/${conversation.id}/messages/${created.body.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(204)

    assert.equal(await Message.findById(created.body.id), null)

    const savedUser = await User.findById(alice.id)
    assert.equal(savedUser.messages.length, 0)

    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].room, conversation.id)
    assert.equal(emittedEvents[0].event, 'message:deleted')
    assert.equal(emittedEvents[0].payload, created.body.id)
  })
})

after(async () => {
  await mongoose.connection.close()
})

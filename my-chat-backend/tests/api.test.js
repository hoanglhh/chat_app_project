const { after, beforeEach, describe, mock, test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const supertest = require('supertest')
const jwt = require('jsonwebtoken')

require('dotenv').config()

if (!process.env.TEST_MONGODB_URI) {
  throw new Error(
    'TEST_MONGODB_URI is required. Use a separate database because tests delete its data.'
  )
}

const gemini = require('../services/gemini')
const originalSummarize = gemini.summarizeMessages
const replyMock = mock.method(gemini, 'generateAiReply', async () => {
  throw new Error('Gemini unavailable')
})
const summaryMock = mock.method(gemini, 'summarizeMessages', originalSummarize)
const app = require('../app')
const Conversation = require('../models/conversation')
const Message = require('../models/message')
const User = require('../models/user')

app.set('trust proxy', 1)
const api = supertest.agent(app)
let requestNumber = 0
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
  api.set('X-Forwarded-For', `203.0.113.${++requestNumber}`)
  replyMock.mock.resetCalls()
  replyMock.mock.mockImplementation(async () => { throw new Error('Gemini unavailable') })
  summaryMock.mock.resetCalls()
  summaryMock.mock.mockImplementation(originalSummarize)
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
  test('failed login attempts are limited per client IP', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await api.post('/api/login').send({ username: 'alice', password: 'wrong' }).expect(401)
    }

    const blocked = await api
      .post('/api/login')
      .send({ username: 'alice', password: 'wrong' })
      .expect(429)
    assert.equal(typeof blocked.body.error, 'string')
    assert(Number(blocked.headers['retry-after']) > 0)

    await api
      .post('/api/login')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({ username: 'alice', password: 'wrong' })
      .expect(401)
    await api.post('/api/users').send({}).expect(400)
  })

  test('successful logins do not consume the failed-login allowance', async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await loginAs('alice')
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await api.post('/api/login').send({ username: 'alice', password: 'wrong' }).expect(401)
    }
    await api.post('/api/login').send({ username: 'alice', password: 'wrong' }).expect(429)
  })

  test('registration is limited before another account can be saved', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await api.post('/api/users').send({}).expect(400)
    }
    await api
      .post('/api/users')
      .send({ username: 'blocked-user', name: 'Blocked', password: 'secret123' })
      .expect(429)
    assert.equal(await User.countDocuments({}), 3)
    await loginAs('alice')
  })

  test('listing users requires a valid, unexpired token', async () => {
    await api.get('/api/users').expect(401)
    await api
      .get('/api/users')
      .set('Authorization', 'Bearer invalid')
      .expect(401)

    const expiredToken = jwt.sign({ id: alice.id }, process.env.SECRET, {
      expiresIn: -1
    })
    await api
      .get('/api/users')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401)
  })

  test('authenticated user discovery returns only public profile fields', async () => {
    const token = await loginAs('alice')
    await createMessageAs(token)

    const response = await api
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    assert.equal(response.body.length, 3)
    response.body.forEach(user => {
      assert.deepEqual(Object.keys(user).sort(), ['id', 'name', 'username'])
    })
    assert.deepEqual(response.body.find(user => user.id === alice.id), {
      id: alice.id,
      name: 'Alice',
      username: 'alice'
    })
  })

  test('registration rejects non-string fields and oversized values without saving a user', async () => {
    const credentials = { username: 'dave', name: 'Dave', password: 'secret123' }

    for (const field of ['username', 'name', 'password']) {
      for (const value of [123, true, {}, [], null]) {
        await api
          .post('/api/users')
          .send({ ...credentials, [field]: value })
          .expect(400)
      }
    }

    for (const invalidFields of [
      { username: 'u'.repeat(101) },
      { name: 'n'.repeat(101) },
      { password: 'p'.repeat(73) },
      { password: 'é'.repeat(37) }
    ]) {
      await api
        .post('/api/users')
        .send({ ...credentials, ...invalidFields })
        .expect(400)
    }

    await api.post('/api/users').expect(400)
    assert.equal(await User.countDocuments({}), 3)
  })

  test('registration accepts values at the maximum lengths', async () => {
    const response = await api
      .post('/api/users')
      .send({
        username: 'u'.repeat(100),
        name: 'n'.repeat(100),
        password: 'é'.repeat(36)
      })
      .expect(201)

    assert.equal(response.body.username.length, 100)
    assert.equal(response.body.name.length, 100)
  })

  test('login rejects malformed credentials and missing bodies without server errors', async () => {
    for (const field of ['username', 'password']) {
      for (const value of [123, true, {}, [], null]) {
        await api
          .post('/api/login')
          .send({ username: 'alice', password: 'secret123', [field]: value })
          .expect(401)
      }
    }

    await api.post('/api/login').expect(401)
    await api
      .post('/api/login')
      .send({ username: 'alice', password: 'p'.repeat(73) })
      .expect(401)
  })

  test('existing accounts can log in with credentials predating registration length limits', async () => {
    for (const [username, password] of [
      ['legacy-password', 'p'.repeat(73)],
      ['u'.repeat(101), 'secret123'],
      ['legacy-unicode', 'é'.repeat(37)]
    ]) {
      const legacyUser = await new User({
        username,
        name: 'Existing user',
        passwordHash: await bcrypt.hash(password, 4)
      }).save()

      const response = await api
        .post('/api/login')
        .send({ username, password })
        .expect(200)
      assert.equal(response.body.id, legacyUser.id)
    }
  })

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
  test('a new direct conversation notifies its recipient', async () => {
    const token = await loginAs('alice')
    const response = await api
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: charlie.id })
      .expect(201)

    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].room, `user:${charlie.id}`)
    assert.equal(emittedEvents[0].event, 'conversation:created')
    assert.deepEqual(JSON.parse(JSON.stringify(emittedEvents[0].payload)), response.body)
  })

  test('direct-chat notifications use the canonical recipient ID', async () => {
    const token = await loginAs('alice')
    const response = await api
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: charlie.id.toUpperCase() })
      .expect(201)

    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].room, `user:${charlie.id}`)
    assert.equal(emittedEvents[0].payload.id, response.body.id)
  })

  test('direct conversation creation rejects malformed participant IDs and missing bodies', async () => {
    const token = await loginAs('alice')

    for (const participantId of [123, true, {}, [], null, ' '.repeat(24)]) {
      await api
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantId })
        .expect(400)
    }

    await api
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
    assert.equal(await Conversation.countDocuments({}), 1)
  })

  test('group creation rejects invalid names and missing bodies', async () => {
    const token = await loginAs('alice')

    for (const name of [123, true, {}, [], null, 'n'.repeat(101)]) {
      await api
        .post('/api/conversations/group')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, participantIds: [bob.id, charlie.id] })
        .expect(400)
    }

    await api
      .post('/api/conversations/group')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
    assert.equal(await Conversation.countDocuments({}), 1)
  })

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
    assert.equal(emittedEvents.length, 0)
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
  test('history pages are bounded, stable with equal timestamps, and unaffected by new messages or a deleted cursor', async () => {
    const token = await loginAs('alice')
    await Message.insertMany(Array.from({ length: 126 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(index.toString(16).padStart(24, '0')),
      name: 'Alice',
      content: `Message ${index}`,
      user: alice._id,
      conversation: conversation._id,
      createdAt: index < 76 ? '2026-11-07T12:00:00.000Z' : '2026-11-07T13:00:00.000Z'
    })))

    const url = `/api/conversations/${conversation.id}/messages`
    const first = await api.get(url).set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(Array.isArray(first.body.messages), true)
    assert.equal(first.body.messages.length, 50)
    assert.equal(first.body.messages[0].content, 'Message 76')
    assert.equal(first.body.messages[49].content, 'Message 125')
    assert.equal(typeof first.body.nextCursor, 'string')

    await Message.findByIdAndDelete(first.body.messages[0].id)
    await Message.create({ name: 'Alice', content: 'New arrival', user: alice._id,
      conversation: conversation._id, createdAt: '2026-11-07T14:00:00.000Z' })

    const second = await api.get(url).query({ before: first.body.nextCursor })
      .set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(second.body.messages.length, 50)
    assert.equal(second.body.messages[0].content, 'Message 26')
    assert.equal(second.body.messages[49].content, 'Message 75')
    const third = await api.get(url).query({ before: second.body.nextCursor })
      .set('Authorization', `Bearer ${token}`).expect(200)
    assert.equal(third.body.messages.length, 26)
    assert.equal(third.body.messages[0].content, 'Message 0')
    assert.equal(third.body.nextCursor, null)
    const ids = [...first.body.messages, ...second.body.messages, ...third.body.messages].map(message => message.id)
    assert.equal(new Set(ids).size, 126)
  })

  test('empty history returns a final page and malformed cursors are rejected', async () => {
    const token = await loginAs('alice')
    const url = `/api/conversations/${conversation.id}/messages`
    const empty = await api.get(url).set('Authorization', `Bearer ${token}`).expect(200)
    assert.deepEqual(empty.body, { messages: [], nextCursor: null })

    for (const before of ['', 'bad', 'not-a-date_000000000000000000000001',
      '2026-11-07T12:00:00.000Z_not-an-id', '2026-02-30T12:00:00.000Z_000000000000000000000001']) {
      await api.get(url).query({ before }).set('Authorization', `Bearer ${token}`).expect(400)
    }
    await api.get(`${url}?before=x&before=y`).set('Authorization', `Bearer ${token}`).expect(400)
  })

  test('a failed AI reply keeps the user message and returns a usable error', async () => {
    const token = await loginAs('alice')
    const ai = await api.post('/api/conversations/ai').set('Authorization', `Bearer ${token}`).send({}).expect(201)
    const response = await api.post(`/api/conversations/${ai.body.id}/ai-messages`)
      .set('Authorization', `Bearer ${token}`).send({ content: 'Please answer this' }).expect(502)

    assert.equal(replyMock.mock.calls.length, 1)
    assert.equal(response.body.userMessage.content, 'Please answer this')
    assert.equal(await Message.countDocuments({}), 1)
    assert.equal((await User.findById(alice.id)).messages[0].toString(), response.body.userMessage.id)
    assert.equal(emittedEvents.length, 1)
    assert.equal(emittedEvents[0].payload.role, 'user')
  })

  test('an AI reply saves and broadcasts both messages with recent history', async () => {
    replyMock.mock.mockImplementation(async () => 'A test reply')
    const token = await loginAs('alice')
    const ai = await api.post('/api/conversations/ai').set('Authorization', `Bearer ${token}`).send({}).expect(201)
    const response = await api.post(`/api/conversations/${ai.body.id}/ai-messages`)
      .set('Authorization', `Bearer ${token}`).send({ content: 'A test question' }).expect(201)

    assert.equal(replyMock.mock.calls.length, 1)
    assert.equal(replyMock.mock.calls[0].arguments[0].at(-1).content, 'A test question')
    assert.equal(response.body.assistantMessage.content, 'A test reply')
    assert.equal(response.body.assistantMessage.role, 'assistant')
    assert.equal(await Message.countDocuments({}), 2)
    assert.deepEqual(emittedEvents.map(event => event.payload.role), ['user', 'assistant'])
  })

  test('a failed summary returns a JSON error without losing messages', async () => {
    summaryMock.mock.mockImplementation(async () => { throw new Error('Gemini quota exceeded') })
    const token = await loginAs('alice')
    await createMessageAs(token)
    const response = await api.post(`/api/conversations/${conversation.id}/summary`)
      .set('Authorization', `Bearer ${token}`).expect(502).expect('Content-Type', /json/)
    assert.equal(summaryMock.mock.calls.length, 1)
    assert.equal(typeof response.body.error, 'string')
    assert.equal(await Message.countDocuments({}), 1)
  })

  test('message creation and editing reject invalid content without changing stored messages', async () => {
    const token = await loginAs('alice')
    const created = await createMessageAs(token)
    const baseUrl = `/api/conversations/${conversation.id}/messages`

    for (const content of [123, true, {}, [], null, '', '   ', 'm'.repeat(10001)]) {
      await api
        .post(baseUrl)
        .set('Authorization', `Bearer ${token}`)
        .send({ content })
        .expect(400)
      await api
        .put(`${baseUrl}/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content })
        .expect(400)
    }

    await api.post(baseUrl).set('Authorization', `Bearer ${token}`).expect(400)
    await api
      .put(`${baseUrl}/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    assert.equal(await Message.countDocuments({}), 1)
    assert.equal((await Message.findById(created.body.id)).content, 'Hello from Alice')
  })

  test('AI messages reject invalid content before saving or calling Gemini', async () => {
    const token = await loginAs('alice')
    const aiConversation = await api
      .post('/api/conversations/ai')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201)
    const url = `/api/conversations/${aiConversation.body.id}/ai-messages`

    for (const content of [123, true, {}, [], null, '', '   ', 'm'.repeat(10001)]) {
      await api
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ content })
        .expect(400)
    }

    await api.post(url).set('Authorization', `Bearer ${token}`).expect(400)
    assert.equal(await Message.countDocuments({}), 0)
    assert.equal(emittedEvents.length, 0)
  })

  test('messages accept content at the maximum length', async () => {
    const token = await loginAs('alice')
    const response = await createMessageAs(token, conversation.id, 'm'.repeat(10000))
    assert.equal(response.body.content.length, 10000)
  })

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

    assert.equal(messages.body.messages.length, 1)
    assert.equal(messages.body.messages[0].id, response.body.id)
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

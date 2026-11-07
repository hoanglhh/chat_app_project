import { test, expect } from '@playwright/test'

const user = { id: 'user-1', name: 'Test User', username: 'tester', token: 'test-token' }
const people = [
  { id: 'user-2', name: 'Person A', username: 'person_a' },
  { id: 'user-3', name: 'Person B', username: 'person_b' }
]
const message = (id, content, conversation = 'chat-a', createdAt = '2026-11-07T13:00:00.000Z') => ({
  id, content, conversation, createdAt, user: user.id, name: user.name, role: 'user'
})
const original = message('original', 'Existing message in A', 'chat-a', '2026-11-07T12:00:00.000Z')
const input = page => page.getByRole('textbox', { name: 'Message', exact: true })
const settle = page => page.evaluate(() => new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve))
}))

async function setupChat(page) {
  const pending = new Map()
  await page.addInitScript(value => localStorage.setItem('loggedChatUser', JSON.stringify(value)), user)
  await page.route('**/socket.io/**', route => route.abort())
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const key = `${request.method()} ${path}`
    if (path === '/api/auth/google/config') return route.fulfill({ json: { enabled: false } })
    if (pending.has(key)) {
      const resolve = pending.get(key)
      pending.delete(key)
      resolve(route)
      return
    }
    if (path === '/api/users') {
      return route.fulfill(request.headers().authorization
        ? { json: people }
        : { status: 401, json: { error: 'token required' } })
    }
    if (path === '/api/login') return route.fulfill({ json: { ...user, token: 'new-token' } })
    if (path === '/api/conversations/ai') {
      return route.fulfill({ json: { id: 'chat-ai', type: 'ai', name: 'Gemini', participants: [user] } })
    }
    if (path === '/api/conversations') {
      return route.fulfill({ json: people.map((person, index) => ({
        id: index === 0 ? 'chat-a' : 'chat-b', type: 'direct', participants: [user, person]
      })) })
    }
    if (request.method() === 'GET' && path.endsWith('/messages')) {
      return route.fulfill({ json: { messages: path.includes('chat-a') ? [original] : [], nextCursor: null } })
    }
    if (request.method() === 'POST' && path.endsWith('/messages')) {
      return route.fulfill({ status: 201, json: message('new-message', request.postDataJSON().content) })
    }
    throw new Error(`Unexpected request: ${key}`)
  })

  const select = async name => {
    await page.getByRole('navigation', { name: 'Conversations' }).getByRole('button')
      .filter({ hasText: name }).click()
    await input(page).waitFor()
  }
  return {
    select,
    hold: (method, path) => new Promise(resolve => pending.set(`${method} ${path}`, resolve)),
    open: async () => {
      await page.goto('/')
      await select('Person A')
      await expect(page.getByText(original.content, { exact: true })).toBeVisible()
    }
  }
}

test('sending then switching chats preserves the new chat and its draft', async ({ page }) => {
  const chat = await setupChat(page)
  await chat.open()
  const pending = chat.hold('POST', '/api/conversations/chat-a/messages')
  await input(page).fill('Delayed message for A')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const route = await pending
  await chat.select('Person B')
  await input(page).fill('Draft for B')
  await route.fulfill({ status: 201, json: message('sent-a', 'Delayed message for A') })
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
  await expect(input(page)).toHaveValue('Draft for B')
  await expect(page.getByText('Delayed message for A', { exact: true })).toHaveCount(0)
})

test('an edit response cannot erase another chat draft', async ({ page }) => {
  const chat = await setupChat(page)
  await chat.open()
  const pending = chat.hold('PUT', '/api/conversations/chat-a/messages/original')
  await page.getByRole('button', { name: 'Open message actions' }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await input(page).fill('Edited message')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const route = await pending
  await chat.select('Person B')
  await input(page).fill('Draft after leaving edit')
  await route.fulfill({ json: { ...original, content: 'Edited message' } })
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled()
  await expect(input(page)).toHaveValue('Draft after leaving edit')
})

test('a summary response stays with its original chat', async ({ page }) => {
  const chat = await setupChat(page)
  await chat.open()
  const pending = chat.hold('POST', '/api/conversations/chat-a/summary')
  await page.getByRole('button', { name: 'Catch me up on this conversation' }).click()
  const route = await pending
  await chat.select('Person B')
  await route.fulfill({ json: { summary: 'Summary for A' } })
  await expect(page.getByRole('button', { name: 'Creating conversation recap' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Conversation recap' })).toHaveCount(0)
})

test('send completion preserves a newer draft in the same chat', async ({ page }) => {
  const chat = await setupChat(page)
  await chat.open()
  const pending = chat.hold('POST', '/api/conversations/chat-a/messages')
  await input(page).fill('First draft')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const route = await pending
  await input(page).fill('Next draft')
  await route.fulfill({ status: 201, json: message('sent', 'First draft') })
  await expect(page.getByText('First draft', { exact: true })).toBeVisible()
  await expect(input(page)).toHaveValue('Next draft')
})

test('a previous session summary failure cannot log out a new session', async ({ page }) => {
  const chat = await setupChat(page)
  await chat.open()
  const pending = chat.hold('POST', '/api/conversations/chat-a/summary')
  await page.getByRole('button', { name: 'Catch me up on this conversation' }).click()
  const route = await pending
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByLabel('Username', { exact: true }).fill('tester')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await chat.select('Person B')
  await input(page).fill('New session draft')
  await route.fulfill({ status: 401, json: { error: 'token expired' } })
  await settle(page)
  await expect(input(page)).toHaveValue('New session draft')
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible()
})

test('login rate limit shows the server error instead of incorrect credentials', async ({ page }) => {
  await setupChat(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.route('**/api/login', route => route.fulfill({
    status: 429, json: { error: 'Too many login attempts. Please try again in 15 minutes.' }
  }))
  await page.getByLabel('Username', { exact: true }).fill('tester')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Too many login attempts')
})

async function paginatedChat(page) {
  const chat = await setupChat(page)
  const recent = Array.from({ length: 50 }, (_, index) => message(
    `recent-${index}`, `Recent message ${index}`, 'chat-a', new Date(Date.UTC(2026, 10, 7, 12, 0, index)).toISOString()
  ))
  await page.route('**/api/conversations/chat-a/messages', route => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ json: { messages: recent, nextCursor: 'older' } })
  })
  await page.goto('/')
  await chat.select('Person A')
  await expect(page.getByText('Recent message 49', { exact: true })).toBeVisible()
  return chat
}

test('older history is prepended without moving the visible scroll anchor or losing a new message', async ({ page }) => {
  await paginatedChat(page)
  let release
  const requested = new Promise(resolve => { release = resolve })
  await page.route('**/api/conversations/chat-a/messages?before=older', route => release(route))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  const route = await requested
  await input(page).fill('New arrival while loading history')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('New arrival while loading history', { exact: true })).toBeVisible()
  await page.getByRole('region', { name: 'Message history' }).evaluate(element => element.scrollTo({ top: 0, behavior: 'instant' }))
  const anchor = page.getByText('Recent message 0', { exact: true })
  const before = await anchor.boundingBox()
  await route.fulfill({ json: { messages: [message('older', 'An older message', 'chat-a', '2026-11-06T12:00:00.000Z')], nextCursor: null } })
  await expect(page.getByText('An older message', { exact: true })).toHaveCount(1)
  await expect(page.getByText('New arrival while loading history', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Load older messages', exact: true })).toHaveCount(0)
  await expect.poll(async () => Math.abs((await anchor.boundingBox()).y - before.y)).toBeLessThan(2)
})

test('a delayed older page cannot change the newly selected chat', async ({ page }) => {
  await paginatedChat(page)
  let release
  const requested = new Promise(resolve => { release = resolve })
  await page.route('**/api/conversations/chat-a/messages?before=older', route => release(route))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  const route = await requested
  await page.getByRole('navigation', { name: 'Conversations' }).getByRole('button').filter({ hasText: 'Person B' }).click()
  await input(page).fill('Draft for B')
  await route.fulfill({ json: { messages: [message('older', 'Wrong chat history')], nextCursor: 'more' } })
  await settle(page)
  await expect(input(page)).toHaveValue('Draft for B')
  await expect(page.getByText('Wrong chat history', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Load older messages', exact: true })).toHaveCount(0)
})

test('an older page from a previous visit cannot replace the reopened chat cursor', async ({ page }) => {
  const chat = await paginatedChat(page)
  let release
  const requested = new Promise(resolve => { release = resolve })
  await page.route('**/api/conversations/chat-a/messages?before=older', route => release(route))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  const route = await requested
  await chat.select('Person B')
  await chat.select('Person A')
  await expect(page.getByText('Recent message 49', { exact: true })).toBeVisible()
  await route.fulfill({ json: { messages: [message('stale', 'History from previous visit')], nextCursor: null } })
  await settle(page)
  await expect(page.getByRole('button', { name: 'Load older messages', exact: true })).toBeVisible()
  await expect(page.getByText('History from previous visit', { exact: true })).toHaveCount(0)
})

test('older history remains usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await paginatedChat(page)
  const button = page.getByRole('button', { name: 'Load older messages', exact: true })
  await button.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('mobile-history.png') })
  await expect(button).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.route('**/api/conversations/chat-a/messages?before=older', route => route.fulfill({
    json: { messages: [message('mobile-older', 'Older mobile history', 'chat-a', '2026-11-06T12:00:00.000Z')], nextCursor: null }
  }))
  await button.click()
  await expect(page.getByText('Older mobile history', { exact: true })).toHaveCount(1)
})

test('a failed older page can be retried without losing current messages', async ({ page }) => {
  await paginatedChat(page)
  await page.route('**/api/conversations/chat-a/messages?before=older', route => route.fulfill({ status: 500, json: { error: 'Unavailable' } }))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Failed to load older messages')
  await expect(page.getByText('Recent message 49', { exact: true })).toHaveCount(1)
  await page.route('**/api/conversations/chat-a/messages?before=older', route => route.fulfill({
    json: { messages: [message('older', 'Recovered history', 'chat-a', '2026-11-06T12:00:00.000Z')], nextCursor: null }
  }))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  await expect(page.getByText('Recovered history', { exact: true })).toHaveCount(1)
})

test('a delayed history page respects live edits and deletions received before it resolves', async ({ page }) => {
  await paginatedChat(page)
  let release
  const requested = new Promise(resolve => { release = resolve })
  await page.route('**/api/conversations/chat-a/messages?before=older', route => release(route))
  await page.getByRole('button', { name: 'Load older messages', exact: true }).click()
  const route = await requested
  const deleted = message('deleted-old', 'Deleted older message', 'chat-a', '2026-11-06T12:00:00.000Z')
  const edited = message('edited-old', 'Original older content', 'chat-a', '2026-11-06T12:00:01.000Z')

  await page.evaluate(async ({ deletedId, updated }) => {
    const { default: socket } = await import('/services/socket.js')
    socket.listeners('message:deleted').forEach(listener => listener(deletedId))
    socket.listeners('message:updated').forEach(listener => listener(updated))
  }, { deletedId: deleted.id, updated: { ...edited, content: 'Latest edited content' } })

  await route.fulfill({ json: { messages: [deleted, edited], nextCursor: null } })
  await expect(page.getByText('Latest edited content', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Deleted older message', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Original older content', { exact: true })).toHaveCount(0)
})

test('initial history loading preserves a message sent before its response', async ({ page }) => {
  const chat = await setupChat(page)
  const requested = chat.hold('GET', '/api/conversations/chat-a/messages')
  await page.goto('/')
  await chat.select('Person A')
  const route = await requested
  await input(page).fill('Sent while history loads')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(input(page)).toHaveValue('')
  await route.fulfill({ json: { messages: [original], nextCursor: null } })
  await expect(page.getByText('Existing message in A', { exact: true })).toBeVisible()
  await expect(page.getByText('Sent while history loads', { exact: true })).toBeVisible()
})

test('an AI failure still displays the saved user message exactly once', async ({ page }) => {
  const chat = await setupChat(page)
  await page.goto('/')
  await chat.select('Gemini')
  await page.route('**/api/conversations/chat-ai/ai-messages', route => route.fulfill({
    status: 502,
    json: { error: 'Gemini could not reply. Your message was still saved.', userMessage: message('saved-ai', 'Keep this question', 'chat-ai') }
  }))
  await input(page).fill('Keep this question')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your message was still saved')
  await expect(page.getByText('Keep this question', { exact: true })).toHaveCount(1)
})

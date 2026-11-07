import { test, expect } from '@playwright/test'

const session = { id: 'google-user', username: 'google_profile', name: 'Google Person', token: 'app-session-jwt' }
const button = page => page.getByRole('button', { name: 'Continue with Google', exact: true })
const html = result => `<!doctype html><script>window.opener.postMessage(${JSON.stringify({ type: 'chat:google-login', ...result })}, 'http://127.0.0.1:5173');window.close()</script>`

async function setup(page, enabled = true) {
  await page.context().route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/google/config') return route.fulfill({ json: { enabled } })
    if (path === '/api/conversations/ai') return route.fulfill({ json: { id: 'ai', name: 'Gemini', type: 'ai', participants: [session] } })
    if (path === '/api/users' || path === '/api/conversations') return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.context().route('**/socket.io/**', route => route.abort())
}

test('configured Google sign-in creates the normal persisted app session', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await setup(page)
  await page.context().route('http://localhost:3001/api/auth/google', route => route.fulfill({
    contentType: 'text/html', body: html({ user: session })
  }))
  await page.goto('/')
  await expect(button(page)).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('google-login.png') })
  await button(page).click()
  await expect(page.getByText('Google Person', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('loggedChatUser')))).toEqual(session)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
})

test('Google is hidden when unavailable and password login remains available', async ({ page }) => {
  await setup(page, false)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible()
  await expect(button(page)).toHaveCount(0)
})

test('blocked and closed Google popups leave the password form usable', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => { window.open = () => null })
  await page.goto('/')
  await button(page).click()
  await expect(page.getByRole('alert')).toContainText('popup')
  await expect(button(page)).toBeEnabled()
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
})

test('closing the Google popup cancels loading', async ({ page }) => {
  await setup(page)
  await page.context().route('http://localhost:3001/api/auth/google', route => route.fulfill({ contentType: 'text/html', body: '<p>Google login</p>' }))
  await page.goto('/')
  const opened = page.waitForEvent('popup')
  await button(page).click()
  const popup = await opened
  await popup.close()
  await expect(button(page)).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('closed')
})

test('only the expected backend origin and the opened popup can deliver a session', async ({ page }) => {
  await setup(page)
  let release
  const pending = new Promise(resolve => { release = resolve })
  await page.context().route('http://localhost:3001/api/auth/google', route => release(route))
  await page.goto('/')
  await button(page).click()
  const route = await pending
  await page.evaluate(user => {
    const data = { type: 'chat:google-login', user }
    window.dispatchEvent(new MessageEvent('message', { origin: 'http://localhost:3001', source: window, data }))
    const popup = window.open('', 'chat-google-login')
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://untrusted.example', source: popup, data }))
  }, session)
  expect(await page.evaluate(() => localStorage.getItem('loggedChatUser'))).toBeNull()
  await route.fulfill({ contentType: 'text/html', body: html({ user: session }) })
  await expect(page.getByText('Google Person', { exact: true })).toBeVisible()
})

test('provider cancellation shows a useful error without creating a session', async ({ page }) => {
  await setup(page)
  await page.context().route('http://localhost:3001/api/auth/google', route => route.fulfill({ contentType: 'text/html', body: html({ error: 'Google sign-in was cancelled.' }) }))
  await page.goto('/')
  await button(page).click()
  await expect(page.getByRole('alert')).toContainText('cancelled')
  expect(await page.evaluate(() => localStorage.getItem('loggedChatUser'))).toBeNull()
  await expect(button(page)).toBeEnabled()
})

test('password login cancels an outstanding Google popup', async ({ page }) => {
  await setup(page)
  const localSession = { ...session, id: 'local-user', name: 'Password Person', token: 'local-jwt' }
  await page.context().route('**/api/login', route => route.fulfill({ json: localSession }))
  await page.context().route('http://localhost:3001/api/auth/google', route => route.fulfill({ contentType: 'text/html', body: '<p>Login pending</p>' }))
  await page.goto('/')
  const opened = page.waitForEvent('popup')
  await button(page).click()
  const popup = await opened
  await page.getByLabel('Username', { exact: true }).fill('local-user')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByText('Password Person', { exact: true })).toBeVisible()
  await expect.poll(() => popup.isClosed()).toBe(true)
})

test('an earlier password response cannot replace a completed Google session', async ({ page }) => {
  await setup(page)
  let release
  const requested = new Promise(resolve => { release = resolve })
  await page.context().route('**/api/login', route => release(route))
  await page.context().route('http://localhost:3001/api/auth/google', route => route.fulfill({ contentType: 'text/html', body: html({ user: session }) }))
  await page.goto('/')
  await page.getByLabel('Username', { exact: true }).fill('local-user')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  const route = await requested
  await button(page).click()
  await expect(page.getByText('Google Person', { exact: true })).toBeVisible()
  await route.fulfill({ json: { ...session, name: 'Old password response', token: 'old-jwt' } })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(page.getByText('Google Person', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('loggedChatUser')).token)).toBe('app-session-jwt')
})

import axios from 'axios'

const backendUrl =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001'
  
const baseUrl = `${backendUrl}/api/login`

const login = async credentials => {
  const res = await axios.post(baseUrl, credentials)
  return res.data
}

const getGoogleConfig = () => axios.get(`${backendUrl}/api/auth/google/config`).then(response => response.data)

const loginWithGoogle = signal => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException('Login cancelled', 'AbortError'))
  const popup = window.open(`${backendUrl}/api/auth/google`, 'chat-google-login', 'width=500,height=650')
  if (!popup) return reject(new Error('Please allow popups to sign in with Google.'))
  const expectedOrigin = new URL(backendUrl, window.location.href).origin
  let timer
  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    signal.removeEventListener('abort', onAbort)
    window.clearInterval(timer)
    if (!popup.closed) popup.close()
  }
  const onAbort = () => {
    cleanup()
    reject(new DOMException('Login cancelled', 'AbortError'))
  }
  const onMessage = event => {
    if (event.origin !== expectedOrigin || event.source !== popup || event.data?.type !== 'chat:google-login') return
    cleanup()
    const user = event.data.user
    if (user && ['token', 'id', 'username', 'name'].every(key => typeof user[key] === 'string' && user[key])) {
      resolve(user)
    } else {
      reject(new Error(typeof event.data.error === 'string' ? event.data.error : 'Google sign-in failed. Please try again.'))
    }
  }
  window.addEventListener('message', onMessage)
  signal.addEventListener('abort', onAbort, { once: true })
  timer = window.setInterval(() => {
    if (popup.closed) {
      cleanup()
      reject(new Error('Google sign-in window was closed. Please try again.'))
    }
  }, 300)
})

export default { login, getGoogleConfig, loginWithGoogle }

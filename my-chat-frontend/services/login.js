import axios from 'axios'
const backendUrl =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001'
const baseUrl = `${backendUrl}/api/login`

const login = async credentials => {
  const res = await axios.post(baseUrl, credentials)
  return res.data
}

export default { login }
import axios from 'axios'
const backendUrl =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001'
const baseUrl = `${backendUrl}/api/messages`
let token = null

const setToken = newToken => {
  token = newToken ? `Bearer ${newToken}` : null
}

const getConfig = () => ({
  headers: {
    Authorization: token
  }
})

const remove = id => {
  return axios.delete(`${baseUrl}/${id}`, getConfig())
}

const create = newMessage => {
  return axios.post(baseUrl, newMessage, getConfig())
  .then(response => response.data)
}

const getAll = () => {
  return axios.get(baseUrl)
  .then(response => response.data)
}

const update = (id, newMessage) => {
  return axios.put(`${baseUrl}/${id}`, newMessage, getConfig())
    .then(response => response.data)
}

export default { setToken, remove, create, getAll, update }

import axios from 'axios'

const backendUrl =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3001'

const baseUrl = `${backendUrl}/api/conversations`
let token = null

const setToken = newToken => {
  token = newToken ? `Bearer ${newToken}` : null
}

const getConfig = () => ({
  headers: {
    Authorization: token
  }
})

const getAll = () => {
  return axios.get(baseUrl, getConfig())
  .then(response => response.data)
}

const create = participantId => {
  return axios.post(baseUrl, { participantId }, getConfig())
  .then(response => response.data)
}

const getMessages = conversationId => {
  return axios
    .get(`${baseUrl}/${conversationId}/messages`, getConfig())
    .then(response => response.data)
}

const createMessage = (conversationId, newMessage) => {
  return axios
    .post(
      `${baseUrl}/${conversationId}/messages`,
      newMessage,
      getConfig()
    )
    .then(response => response.data)
}

const getOrCreateAiConversation = () => {
  return axios
    .post(`${baseUrl}/ai`, {}, getConfig())
    .then(response => response.data)
}

const createAiMessage = (conversationId, newMessage) => {
  return axios
    .post(
      `${baseUrl}/${conversationId}/ai-messages`,
      newMessage,
      getConfig()
    )
    .then(response => response.data)
}

const updateMessage = (
  conversationId,
  messageId,
  changes
) => {
  return axios
    .put(
      `${baseUrl}/${conversationId}/messages/${messageId}`,
      changes,
      getConfig()
    )
    .then(response => response.data)
}

const removeMessage = (conversationId, messageId) => {
  return axios.delete(
    `${baseUrl}/${conversationId}/messages/${messageId}`,
    getConfig()
  )
}

const summarize = conversationId => {
  return axios
    .post(
      `${baseUrl}/${conversationId}/summary`,
      {},
      getConfig()
    )
    .then(response => response.data.summary)
}

export default {
  setToken,
  getAll,
  create,
  getMessages,
  createMessage,
  getOrCreateAiConversation,
  createAiMessage,
  updateMessage,
  removeMessage,
  summarize
}

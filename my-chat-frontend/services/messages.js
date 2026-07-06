import axios from 'axios'
const baseUrl = 'http://localhost:3001/messages'

const remove = id => {
  return axios.delete(`${baseUrl}/${id}`)
}

const create = newMessage => {
  return axios.post(baseUrl, newMessage)
  .then(response => response.data)
}

const getAll = () => {
  return axios.get(baseUrl)
  .then(response => response.data)
}

const update = (id, newMessage) => {
  return axios.put(`${baseUrl}/${id}`, newMessage)
    .then(response => response.data)
}

export default { remove, create, getAll, update }

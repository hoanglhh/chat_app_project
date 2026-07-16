import { useState, useEffect, useRef } from "react"
import MessageForm from "../components/MessageForm"
import MessageList from "../components/MessageList"
import messageService from '../services/messages'
import Notification from '../components/Notification'

const App = () => {
  const [messages, setMessages] = useState([]) 
  const [content, setContent] = useState('')
  const [notification, setNotification] = useState({ message: null })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(() => {
    return window.localStorage.getItem('chatName') || ''
  })
  const messageEndRef = useRef(null)
  
  const showNotification = (message) => {
    setNotification({ message })

    setTimeout(() => {
      setNotification({ message: null })
    }, 5000)
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {

    messageService.getAll()
    .then(initialMessages => {
      setMessages(initialMessages)
  })
    .catch(() => {
      showNotification('Failed to load messages')
    })
    .finally(() => {
      setLoading(false)
    })
}, [])

  useEffect(() => {
    if (name.trim() !== '') {
      window.localStorage.setItem('chatName', name)
    }
  }, [name])
  
  const addMessage = (event) => {
    event.preventDefault()

    if (name.trim() === '' || content.trim() === '') {
      return
    }

    const messageObject = {
      name,
      content,
      createdAt: new Date().toISOString(),
    }
    
    setSending(true)
    
    messageService
    .create(messageObject)
    .then(returnedMessage => {
      setMessages(messages.concat(returnedMessage))
      setContent('')
    })
    .catch(error => {
      if (error.response && error.response.status === 400) {
        showNotification(error.response.data.error)
      } else {
        showNotification('Failed to send message')
      }
    })
    .finally(() => {
      setSending(false)
    })
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this message?')) {
      messageService
      .remove(id)
      .then(() => {
        setMessages(messages.filter(message => message.id !== id))
      })
      .catch(error => {
        if (error.response && error.response.status === 400) {
          showNotification(error.response.data.error)
        } else {
          showNotification('Failed! - Try deleting again')
        }
      })
    }
  }

  const handleNameChange = (event) => {
    setName(event.target.value)
  }
  
  const handleContentChange = (event) => {
    setContent(event.target.value)
  }

  const handleEdit = (id, newContent) => {
    const editMessage = messages.find(message => message.id === id)
    
    if (newContent.trim() === '') {
      return
    }
    
    const changedMessage = {
      ...editMessage,
      content: newContent
    }

    setSaving(true)

    return messageService
    .update(id, changedMessage)
    .then(returnedMessage => {
      setMessages(messages.map(message => 
        message.id === id ? returnedMessage : message
      ))
    })
    .catch(error => {
      if (error.response && error.response.status === 400) {
        showNotification(error.response.data.error)
      } else {
        showNotification('This message has already been deleted')
      }
    })
    .finally(() => {
      setSaving(false)
    })
  }
  
  return (
    <div className="app">
      <h1>Chat App</h1>

      <Notification notification={notification} />

      <div className="chat-panel">
        <div className="message-list">
          {loading ? (
            <p>Loading messages...</p>
          ) : (
            <>
              <MessageList
                messages={messages}
                handleDelete={handleDelete}
                handleEdit={handleEdit}
                saving={saving}
              />
              <div ref={messageEndRef} />
            </>
          )}
        </div>

        <MessageForm
          addMessage={addMessage}
          name={name}
          content={content}
          handleContentChange={handleContentChange}
          handleNameChange={handleNameChange}
          sending={sending}
        />
      </div>
    </div>
  )
}

export default App
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
  const [editingMessageId, setEditingMessageId] = useState(null)
  const isEditing = editingMessageId !== null
  
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

    if (editingMessageId !== null) {
      handleEdit(editingMessageId, content)
      return
    } 

    const messageObject = {
      name,
      content,
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
      setEditingMessageId(null)
      setContent('')
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

  const startEditing = (message) => {
    setEditingMessageId(message.id)
    setContent(message.content)
  }
  
  const cancelEditing = () => {
    setEditingMessageId(null)
    setContent('')
  }

  return (
    <main className="h-dvh overflow-hidden bg-stone-100">
      <div className="mx-auto h-full w-full max-w-3xl sm:p-4">
        <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-sm">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 9.75h6.75m-6.75 3h4.5M21 12c0 4.142-4.03 7.5-9 7.5a10.7 10.7 0 0 1-3.17-.47L3 21l1.58-4.21A7 7 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-slate-900">
                  Chat
                </h1>
              </div>
            </div>

            <p className="ml-3 shrink-0 text-xs text-slate-500">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </p>
          </header>

          <Notification notification={notification} />

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-4 py-5 sm:px-6">
              {loading ? (
                <div className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                  <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                  Loading messages…
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                  <h2 className="text-sm font-medium text-slate-700">
                    No messages yet
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Start the conversation below.
                  </p>
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  handleDelete={handleDelete}
                  currentName={name}
                  startEditing={startEditing}
                />
              )}
              <div ref={messageEndRef} />
            </div>

            <MessageForm
              addMessage={addMessage}
              name={name}
              content={content}
              handleContentChange={handleContentChange}
              handleNameChange={handleNameChange}
              sending={sending}
              saving={saving}
              isEditing={isEditing}
              cancelEditing={cancelEditing}
            />
          </div>
        </section>
      </div>
    </main>
  )
}

export default App

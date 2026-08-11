import { useState, useEffect, useRef } from "react"
import MessageForm from "../components/MessageForm"
import MessageList from "../components/MessageList"
import messageService from '../services/messages'
import Notification from '../components/Notification'
import LoginForm from '../components/LoginForm'
import loginService from '../services/login'
import userService from '../services/users'
import RegisterForm from '../components/RegisterForm'

const App = () => {
  const [messages, setMessages] = useState([]) 
  const [content, setContent] = useState('')
  const [notification, setNotification] = useState({ message: null })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(() => {
    const savedUserJSON =
      window.localStorage.getItem('loggedChatUser')

    return savedUserJSON
      ? JSON.parse(savedUserJSON)
      : null
  })
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
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
    messageService.setToken(user?.token ?? null)
  }, [user])

  const addMessage = (event) => {
    event.preventDefault()

    if (content.trim() === '') {
      return
    }

    if (editingMessageId !== null) {
      handleEdit(editingMessageId, content)
      return
    } 

    const messageObject = {
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

  const handleLogin = async event => {
    event.preventDefault()
    
    try {
      const loggedInUser = await loginService.login({ username, password })
      messageService.setToken(loggedInUser.token)
      setUser(loggedInUser)
      setUsername('')
      setPassword('')
      window.localStorage.setItem(
        'loggedChatUser',
        JSON.stringify(loggedInUser)
      )
    } catch {
      showNotification('wrong credentials')
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem('loggedChatUser')
    setContent('')
    setEditingMessageId(null)
    setUser(null)
  }

  const handleRegister = async event => {
    event.preventDefault()

    try {
      await userService.create({
        username: registerUsername,
        name: registerName,
        password: registerPassword
      })

      showNotification('Account created. You can now log in.')
      setUsername(registerUsername)
      setRegisterUsername('')
      setRegisterName('')
      setRegisterPassword('')
      setShowRegistration(false)
    } catch (error) {
      showNotification(
        error.response?.data?.error || 'Failed to create account'
      )
    }
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

            <div className="ml-3 flex shrink-0 items-center gap-3">
              <p className="hidden text-xs text-slate-500 sm:block">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </p>

              {user && (
                <div className="flex items-center gap-2">
                  <span className="max-w-28 truncate text-sm font-medium text-slate-700">
                    {user.name || user.username}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </header>

          <Notification notification={notification} />
          
          {user === null ? (
          <div>
            {showRegistration ? (
              <>
                <RegisterForm 
                  username={registerUsername}
                  name={registerName}
                  password={registerPassword}
                  setUsername={setRegisterUsername}
                  setName={setRegisterName}
                  setPassword={setRegisterPassword}
                  handleRegister={handleRegister}/>

                  <button
                    type="button"
                    onClick={() => setShowRegistration(false)}
                  >
                    Back to login
                  </button>
              </>
            ) : (
              <>
                <LoginForm
                  username={username}
                  password={password}
                  setUsername={setUsername}
                  setPassword={setPassword}
                  handleLogin={handleLogin}
                />

                <button
                  type="button"
                  onClick={() => setShowRegistration(true)}
                >
                  Create an account
                </button>
              </>
            )}
            


          </div>
        ) : (
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
                  currentName={user.name || user.username}
                  startEditing={startEditing}
                />
              )}
              <div ref={messageEndRef} />
            </div>

            <MessageForm
              addMessage={addMessage}
              content={content}
              handleContentChange={handleContentChange}
              sending={sending}
              saving={saving}
              isEditing={isEditing}
              cancelEditing={cancelEditing}
            />
          </div>
        )}

        </section>
      </div>
    </main>
  )
}

export default App

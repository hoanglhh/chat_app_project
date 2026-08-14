import { useState, useEffect, useRef } from "react"
import MessageForm from "../components/MessageForm"
import MessageList from "../components/MessageList"
import Notification from '../components/Notification'
import LoginForm from '../components/LoginForm'
import loginService from '../services/login'
import userService from '../services/users'
import RegisterForm from '../components/RegisterForm'
import socket from '../services/socket'
import conversationService from '../services/conversations'
import ConversationList from "../components/ConversationList"
import NewConversationModal from '../components/NewConversationModal'

const App = () => {
  const [messages, setMessages] = useState([]) 
  const [content, setContent] = useState('')
  const [notification, setNotification] = useState({ message: null })
  const [loading, setLoading] = useState(false)
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
  const [users, setUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false)
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
  const messageEndRef = useRef(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const isEditing = editingMessageId !== null
  
  const showNotification = (message, type = 'error') => {
    setNotification({ message, type })

    setTimeout(() => {
      setNotification({ message: null, type: 'error' })
    }, 5000)
  }

  const selectConversation = conversationId => {
    if (conversationId === selectedConversationId) {
      return
    }

    setMessages([])
    setLoading(true)
    setEditingMessageId(null)
    setContent('')
    setSelectedConversationId(conversationId)
  }

  const showConversationList = () => {
    setMessages([])
    setLoading(false)
    setEditingMessageId(null)
    setContent('')
    setSelectedConversationId(null)
  }

  const handleLogout = () => {
    window.localStorage.removeItem('loggedChatUser')
    setContent('')
    setEditingMessageId(null)
    setMessages([])
    setConversations([])
    setUsers([])
    setSelectedConversationId(null)
    setIsNewConversationOpen(false)
    setUser(null)
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user || !selectedConversationId) {
      return
    }

    conversationService
      .getMessages(selectedConversationId)
      .then(conversationMessages => {
        setMessages(conversationMessages)
      })
      .catch(error => {
        if (error.response?.status === 401) {
          handleLogout()
          showNotification('Your session expired. Please log in again.')
          return
        }

        showNotification('Failed to load messages')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user, selectedConversationId])

  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected:', socket.id)
    }

    const handleDisconnect = () => {
      console.log('Socket disconnected')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  useEffect(() => {
    const handleMessageCreated = newMessage => {
      setMessages(currentMessages => {
        const alreadyExists = currentMessages.some(
          message => message.id === newMessage.id
        )

        return alreadyExists
        ? currentMessages
        : currentMessages.concat(newMessage)
      })
    }

    socket.on('message:created', handleMessageCreated)

    const handleMessageUpdated = updatedMessage => {
      setMessages(currentMessages =>
        currentMessages.map(message =>
          message.id === updatedMessage.id
            ? updatedMessage
            : message
        )
      )
    }

    socket.on('message:updated', handleMessageUpdated)

    const handleMessageDeleted = deletedMessageId => {
      setMessages(currentMessages =>
        currentMessages.filter(
          message => message.id !== deletedMessageId
        )
      )
    }

    socket.on('message:deleted', handleMessageDeleted)

    return () => {
      socket.off('message:created', handleMessageCreated)
      socket.off('message:updated', handleMessageUpdated)
      socket.off('message:deleted', handleMessageDeleted)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      socket.disconnect()
      return
    }

    socket.auth = {
      token: user.token
    }

    socket.connect()

    return () => {
      socket.disconnect()
    }
  }, [user])

  useEffect(() => {
    const token = user?.token ?? null

    conversationService.setToken(token)
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    Promise.all([
      userService.getAll(),
      conversationService.getAll()
    ])
      .then(([allUsers, initialConversations]) => {
        setUsers(
          allUsers.filter(otherUser => otherUser.id !== user.id)
        )
        setConversations(initialConversations)
      })
      .catch(error => {
        if (error.response?.status === 401) {
          window.localStorage.removeItem('loggedChatUser')
          setUser(null)
          setMessages([])
          setConversations([])
          showNotification('Your session expired. Please log in again.')
          return
        }

        showNotification('Failed to load conversations')
      })
  }, [user])

  useEffect(() => {
    if (!user || !selectedConversationId) {
      return
    }

    const joinConversation = () => {
      socket.emit(
        'conversation:join',
        selectedConversationId,
        response => {
          if (response?.error) {
            showNotification(response.error)
          }
        }
      )
    }

    if (socket.connected) {
      joinConversation()
    }

    socket.on('connect', joinConversation)

    return () => {
      socket.off('connect', joinConversation)
      socket.emit(
        'conversation:leave',
        selectedConversationId
      )
    }
  }, [user, selectedConversationId])

  const addMessage = (event) => {
    event.preventDefault()

    if (!selectedConversationId) {
      showNotification('Select a conversation first')
      return
    }

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
    
    conversationService
      .createMessage(selectedConversationId, messageObject)
      .then(returnedMessage => {
        setMessages(currentMessages => {
          const alreadyExists = currentMessages.some(
            message => message.id === returnedMessage.id
          )

          return alreadyExists
            ? currentMessages
            : currentMessages.concat(returnedMessage)
        })
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
      conversationService
        .removeMessage(
          selectedConversationId,
          id
        )
        .then(() => {
          setMessages(currentMessages =>
            currentMessages.filter(message => message.id !== id)
          )
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
    if (newContent.trim() === '') {
      return
    }

    setSaving(true)

    return conversationService
      .updateMessage(
        selectedConversationId,
        id,
        { content: newContent }
      )
      .then(returnedMessage => {
        setMessages(currentMessages =>
          currentMessages.map(message =>
            message.id === id ? returnedMessage : message
          )
        )
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

  const handleRegister = async event => {
    event.preventDefault()

    try {
      await userService.create({
        username: registerUsername,
        name: registerName,
        password: registerPassword
      })

      showNotification('Account created. You can now log in.', 'success')
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

  const startConversation = async participantId => {
    try {
      const conversation =
        await conversationService.create(participantId)

      setConversations(currentConversations => {
        const alreadyExists = currentConversations.some(
          item => item.id === conversation.id
        )

        return alreadyExists
          ? currentConversations
          : currentConversations.concat(conversation)
      })

      selectConversation(conversation.id)
      return true
    } catch (error) {
      showNotification(
        error.response?.data?.error || 'Failed to start conversation'
      )
      return false
    }
  }

  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedConversationId
  )

  const selectedParticipant = selectedConversation?.participants.find(
    participant => participant.id !== user?.id
  )

  const selectedConversationName = selectedConversation?.type === 'group'
    ? selectedConversation.name
    : selectedParticipant?.name || selectedParticipant?.username

  return (
    <main className="h-dvh overflow-hidden bg-stone-100">
      <div className="mx-auto h-full w-full max-w-5xl sm:p-4">
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

            {user && (
              <div className="ml-3 flex shrink-0 items-center gap-2">
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
          </header>

          <Notification notification={notification} />

          {user === null ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {showRegistration ? (
                <>
                  <RegisterForm
                    username={registerUsername}
                    name={registerName}
                    password={registerPassword}
                    setUsername={setRegisterUsername}
                    setName={setRegisterName}
                    setPassword={setRegisterPassword}
                    handleRegister={handleRegister}
                  />

                  <p className="mt-6 text-center text-sm text-slate-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setShowRegistration(false)}
                    >
                      Log in
                    </button>
                  </p>
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

                  <p className="mt-6 text-center text-sm text-slate-500">
                    New here?{' '}
                    <button
                      type="button"
                      className="font-medium text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      onClick={() => setShowRegistration(true)}
                    >
                      Create an account
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside
              className={`${
                selectedConversationId ? 'hidden md:flex' : 'flex'
              } w-full shrink-0 flex-col bg-white md:w-72 md:border-r md:border-slate-200`}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">
                    Conversations
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Your recent messages
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewConversationOpen(true)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label="Start a new conversation"
                  title="New conversation"
                >
                  <svg
                    aria-hidden="true"
                    className="size-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <ConversationList
                  conversations={conversations}
                  currentUserId={user.id}
                  selectedConversationId={selectedConversationId}
                  onSelect={selectConversation}
                />
              </div>
            </aside>

            <section
              className={`${
                selectedConversationId ? 'flex' : 'hidden md:flex'
              } min-w-0 flex-1 flex-col bg-white`}
            >
              <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
                {selectedConversationId ? (
                  <>
                    <button
                      type="button"
                      onClick={showConversationList}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
                      aria-label="Back to conversations"
                    >
                      <svg
                        aria-hidden="true"
                        className="size-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                      </svg>
                    </button>

                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700"
                    >
                      {selectedConversationName?.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-slate-900">
                        {selectedConversationName}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {selectedConversation?.type === 'group'
                          ? 'Group conversation'
                          : `@${selectedParticipant?.username}`}
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Your messages
                    </h2>
                    <p className="text-xs text-slate-500">
                      Select a conversation from the sidebar
                    </p>
                  </div>
                )}
              </div>

              <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/50 px-4 py-5 sm:px-6">
                {!selectedConversationId ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <svg
                        aria-hidden="true"
                        className="size-7"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.625 9.75h6.75m-6.75 3h4.5M21 12c0 4.142-4.03 7.5-9 7.5a10.7 10.7 0 0 1-3.17-.47L3 21l1.58-4.21A7 7 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z"
                        />
                      </svg>
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Select a conversation
                    </h3>
                    <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">
                      Choose someone from the sidebar to view your messages.
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                    Loading messages…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
                    <h3 className="text-sm font-medium text-slate-700">
                      No messages yet
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Say hello to start this conversation.
                    </p>
                  </div>
                ) : (
                  <MessageList
                    messages={messages}
                    handleDelete={handleDelete}
                    currentUserId={user.id}
                    startEditing={startEditing}
                  />
                )}
                <div ref={messageEndRef} />
              </div>

              {selectedConversationId && (
                <MessageForm
                  addMessage={addMessage}
                  content={content}
                  handleContentChange={handleContentChange}
                  sending={sending}
                  saving={saving}
                  isEditing={isEditing}
                  cancelEditing={cancelEditing}
                />
              )}
            </section>

            {isNewConversationOpen && (
              <NewConversationModal
                users={users}
                onSelect={startConversation}
                onClose={() => setIsNewConversationOpen(false)}
              />
            )}
          </div>
        )}

        </section>
      </div>
    </main>
  )
}

export default App

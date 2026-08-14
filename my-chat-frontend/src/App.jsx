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
import SummaryModal from '../components/SummaryModal'
import InviteMembersModal from '../components/InviteMembersModal'

const appendUniqueMessages = (currentMessages, incomingMessages) => {
  const messageIds = new Set(
    currentMessages.map(message => message.id)
  )

  const uniqueMessages = incomingMessages.filter(message => {
    if (!message || messageIds.has(message.id)) {
      return false
    }

    messageIds.add(message.id)
    return true
  })

  return currentMessages.concat(uniqueMessages)
}

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
  const [isInviteMembersOpen, setIsInviteMembersOpen] = useState(false)
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [showRegistration, setShowRegistration] = useState(false)
  const messageEndRef = useRef(null)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const isEditing = editingMessageId !== null
  const [summary, setSummary] = useState(null)
  const [summarizing, setSummarizing] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [aiRespondingConversationId, setAiRespondingConversationId] = useState(null)
  const selectedConversationIdRef = useRef(null)
  
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
    selectedConversationIdRef.current = conversationId
    setSelectedConversationId(conversationId)
    setSummary(null)
    setIsSummaryOpen(false)
    setIsInviteMembersOpen(false)
  }

  const showConversationList = () => {
    setMessages([])
    setLoading(false)
    setEditingMessageId(null)
    setContent('')
    setSummary(null)
    setIsSummaryOpen(false)
    setIsInviteMembersOpen(false)
    selectedConversationIdRef.current = null
    setSelectedConversationId(null)
  }

  const handleLogout = () => {
    window.localStorage.removeItem('loggedChatUser')
    setContent('')
    setEditingMessageId(null)
    setMessages([])
    setConversations([])
    setUsers([])
    selectedConversationIdRef.current = null
    setSelectedConversationId(null)
    setAiRespondingConversationId(null)
    setIsNewConversationOpen(false)
    setIsInviteMembersOpen(false)
    setUser(null)
    setSummary(null)
    setIsSummaryOpen(false)
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiRespondingConversationId])

  useEffect(() => {
    if (!user || !selectedConversationId) {
      return
    }

    const conversationId = selectedConversationId

    conversationService
      .getMessages(conversationId)
      .then(conversationMessages => {
        if (selectedConversationIdRef.current === conversationId) {
          setMessages(conversationMessages)
        }
      })
      .catch(error => {
        if (error.response?.status === 401) {
          handleLogout()
          showNotification('Your session expired. Please log in again.')
          return
        }

        if (selectedConversationIdRef.current === conversationId) {
          showNotification('Failed to load messages')
        }
      })
      .finally(() => {
        if (selectedConversationIdRef.current === conversationId) {
          setLoading(false)
        }
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
      if (newMessage.conversation !== selectedConversationIdRef.current) {
        return
      }

      setMessages(currentMessages => {
        return appendUniqueMessages(currentMessages, [newMessage])
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

    const handleConversationCreated = newConversation => {
      setConversations(currentConversations => {
        const alreadyExists = currentConversations.some(
          conversation => conversation.id === newConversation.id
        )

        return alreadyExists
          ? currentConversations
          : currentConversations.concat(newConversation)
      })
    }

    socket.on('conversation:created', handleConversationCreated)

    const handleConversationUpdated = updatedConversation => {
      setConversations(currentConversations => {
        const alreadyExists = currentConversations.some(
          conversation => conversation.id === updatedConversation.id
        )

        return alreadyExists
          ? currentConversations.map(conversation =>
              conversation.id === updatedConversation.id
                ? updatedConversation
                : conversation
            )
          : currentConversations.concat(updatedConversation)
      })
    }

    socket.on('conversation:updated', handleConversationUpdated)

    return () => {
      socket.off('message:created', handleMessageCreated)
      socket.off('message:updated', handleMessageUpdated)
      socket.off('message:deleted', handleMessageDeleted)
      socket.off('conversation:created', handleConversationCreated)
      socket.off('conversation:updated', handleConversationUpdated)
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
      conversationService.getAll(),
      conversationService.getOrCreateAiConversation()
    ])
      .then(([allUsers, initialConversations, aiConversation]) => {
        setUsers(
          allUsers.filter(otherUser => otherUser.id !== user.id)
        )
        setConversations([
          aiConversation,
          ...initialConversations.filter(
            conversation => conversation.id !== aiConversation.id
          )
        ])
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

    const activeConversation = conversations.find(
      conversation => conversation.id === selectedConversationId
    )

    if (activeConversation?.type === 'ai') {
      const conversationId = selectedConversationId
      const submittedContent = content

      setContent('')
      setAiRespondingConversationId(conversationId)

      conversationService
        .createAiMessage(conversationId, messageObject)
        .then(({ userMessage, assistantMessage }) => {
          if (selectedConversationIdRef.current !== conversationId) {
            return
          }

          setMessages(currentMessages =>
            appendUniqueMessages(
              currentMessages,
              [userMessage, assistantMessage]
            )
          )
        })
        .catch(error => {
          const savedUserMessage = error.response?.data?.userMessage
          const isStillSelected =
            selectedConversationIdRef.current === conversationId

          if (savedUserMessage && isStillSelected) {
            setMessages(currentMessages =>
              appendUniqueMessages(currentMessages, [savedUserMessage])
            )
          } else if (isStillSelected) {
            setContent(submittedContent)
          }

          if (error.response?.status === 401) {
            handleLogout()
            showNotification('Your session expired. Please log in again.')
            return
          }

          if (error.response?.status === 429) {
            showNotification(
              error.response.data.error ||
              'Too many AI messages. Please try again later.'
            )
            return
          }

          if (error.response?.status === 502) {
            showNotification(
              error.response.data.error ||
              'Gemini could not reply. Please try again.'
            )
            return
          }

          showNotification(
            error.response?.data?.error ||
            'Failed to send message to Gemini'
          )
        })
        .finally(() => {
          setAiRespondingConversationId(currentConversationId =>
            currentConversationId === conversationId
              ? null
              : currentConversationId
          )
        })

      return
    }
    
    setSending(true)
    
    conversationService
      .createMessage(selectedConversationId, messageObject)
      .then(returnedMessage => {
        setMessages(currentMessages =>
          appendUniqueMessages(currentMessages, [returnedMessage])
        )
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

  const startGroupConversation = async (name, participantIds) => {
    try {
      const conversation = await conversationService.createGroup(
        name,
        participantIds
      )

      setConversations(currentConversations =>
        currentConversations.concat(conversation)
      )

      selectConversation(conversation.id)
      return true
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout()
        showNotification('Your session expired. Please log in again.')
        return false
      }

      showNotification(
        error.response?.data?.error || 'Failed to create group'
      )
      return false
    }
  }

  const inviteGroupMembers = async participantIds => {
    try {
      const updatedConversation =
        await conversationService.addParticipants(
          selectedConversationId,
          participantIds
        )

      setConversations(currentConversations =>
        currentConversations.map(conversation =>
          conversation.id === updatedConversation.id
            ? updatedConversation
            : conversation
        )
      )
      showNotification('People added to the group.', 'success')
      return true
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout()
        showNotification('Your session expired. Please log in again.')
        return false
      }

      showNotification(
        error.response?.data?.error || 'Failed to add people'
      )
      return false
    }
  }

  const selectedConversation = conversations.find(
    conversation => conversation.id === selectedConversationId
  )

  const isAiConversation = selectedConversation?.type === 'ai'
  const isGroupConversation = selectedConversation?.type === 'group'

  const selectedParticipant = isAiConversation || isGroupConversation
    ? null
    : selectedConversation?.participants.find(
        participant => participant.id !== user?.id
      )

  const selectedConversationName = isAiConversation
    ? selectedConversation.name || 'Gemini'
    : isGroupConversation
      ? selectedConversation.name
      : selectedParticipant?.name || selectedParticipant?.username

  const availableGroupInvitees = isGroupConversation
    ? users.filter(otherUser =>
        !selectedConversation.participants.some(
          participant => participant.id === otherUser.id
        )
      )
    : []

  const isAiResponding = isAiConversation &&
    aiRespondingConversationId === selectedConversationId

  const handleSummarize = async () => {
    if (!selectedConversationId || summarizing || isAiConversation) {
      return
    }

    setSummarizing(true)

    try {
      const generatedSummary = await conversationService.summarize(
        selectedConversationId
      )

      setSummary(generatedSummary)
      setIsSummaryOpen(true)
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout()
        showNotification('Your session expired. Please log in again.')
        return
      }

      if (error.response?.status === 429) {
        showNotification(
          error.response.data.error ||
          'Too many summary requests. Please try again later.'
        )
        return
      }

      showNotification('Failed to summarize conversation')
    } finally {
      setSummarizing(false)
    }
  }

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
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        isAiConversation
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isAiConversation ? (
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
                            d="m12 3 .8 2.2A5.8 5.8 0 0 0 16.3 8.7l2.2.8-2.2.8a5.8 5.8 0 0 0-3.5 3.5L12 16l-.8-2.2a5.8 5.8 0 0 0-3.5-3.5l-2.2-.8 2.2-.8a5.8 5.8 0 0 0 3.5-3.5L12 3Z"
                          />
                        </svg>
                      ) : (
                        selectedConversationName?.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-slate-900">
                        {selectedConversationName}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {isAiConversation
                          ? 'AI assistant'
                          : isGroupConversation
                            ? `${selectedConversation.participants.length} members`
                            : `@${selectedParticipant?.username}`}
                      </p>
                    </div>

                    {!isAiConversation && (
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {isGroupConversation && (
                          <button
                            type="button"
                            onClick={() => setIsInviteMembersOpen(true)}
                            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label="Add people to this group"
                            title="Add people"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-4.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19.1a7.8 7.8 0 0 0-6 0M12 14.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM19 8v6m3-3h-6"
                              />
                            </svg>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleSummarize}
                          disabled={summarizing || loading || messages.length === 0}
                          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                          aria-label={summarizing ? 'Creating conversation recap' : 'Catch me up on this conversation'}
                          title="Summarize the latest messages"
                        >
                          {summarizing ? (
                            <span className="size-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                          ) : (
                            <svg
                              aria-hidden="true"
                              className="size-4 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m12 3 .8 2.2A5.8 5.8 0 0 0 16.3 8.7l2.2.8-2.2.8a5.8 5.8 0 0 0-3.5 3.5L12 16l-.8-2.2a5.8 5.8 0 0 0-3.5-3.5l-2.2-.8 2.2-.8a5.8 5.8 0 0 0 3.5-3.5L12 3Z"
                              />
                            </svg>
                          )}
                          <span className="hidden sm:inline">
                            {summarizing ? 'Summarizing…' : 'Catch me up'}
                          </span>
                          <span className="sm:hidden">
                            {summarizing ? 'Working…' : 'Recap'}
                          </span>
                        </button>
                      </div>
                    )}
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
                      {isAiConversation
                        ? 'Start a conversation with Gemini'
                        : 'No messages yet'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {isAiConversation
                        ? 'Ask a question or explore an idea.'
                        : 'Say hello to start this conversation.'}
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
                {isAiResponding && (
                  <div
                    role="status"
                    className="mt-5 flex items-center gap-2 pl-1 text-xs text-slate-500"
                  >
                    <span className="size-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                    Gemini is thinking…
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>

              {selectedConversationId && (
                <MessageForm
                  addMessage={addMessage}
                  content={content}
                  handleContentChange={handleContentChange}
                  sending={sending || isAiResponding}
                  saving={saving}
                  isEditing={isEditing}
                  cancelEditing={cancelEditing}
                  isAiConversation={isAiConversation}
                />
              )}
            </section>

            {isNewConversationOpen && (
              <NewConversationModal
                users={users}
                onSelect={startConversation}
                onCreateGroup={startGroupConversation}
                onClose={() => setIsNewConversationOpen(false)}
              />
            )}

            {isInviteMembersOpen && isGroupConversation && (
              <InviteMembersModal
                users={availableGroupInvitees}
                onInvite={inviteGroupMembers}
                onClose={() => setIsInviteMembersOpen(false)}
              />
            )}

            {isSummaryOpen && summary && (
              <SummaryModal
                summary={summary}
                conversationName={selectedConversationName}
                onClose={() => setIsSummaryOpen(false)}
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

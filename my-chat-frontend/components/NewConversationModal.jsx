import { useEffect, useMemo, useState } from 'react'

const NewConversationModal = ({ users, onSelect, onClose }) => {
  const [query, setQuery] = useState('')
  const [startingUserId, setStartingUserId] = useState(null)

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return users
    }

    return users.filter(user =>
      user.name?.toLowerCase().includes(normalizedQuery) ||
      user.username.toLowerCase().includes(normalizedQuery)
    )
  }, [query, users])

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleSelect = async userId => {
    setStartingUserId(userId)
    const succeeded = await onSelect(userId)

    if (succeeded) {
      onClose()
      return
    }

    setStartingUserId(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        className="flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2
              id="new-conversation-title"
              className="text-base font-semibold text-slate-900"
            >
              New conversation
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Search for someone to message
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close new conversation"
          >
            <svg
              aria-hidden="true"
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 px-4 py-3 sm:px-5">
          <label htmlFor="new-conversation-search" className="sr-only">
            Search people
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
            <svg
              aria-hidden="true"
              className="size-4 shrink-0 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-4-4" />
            </svg>
            <input
              id="new-conversation-search"
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by name or username"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>
        </div>

        <div className="chat-scrollbar min-h-0 overflow-y-auto px-3 pb-4 sm:px-4">
          {filteredUsers.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No people found
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try a different name or username.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(otherUser => {
                const displayName = otherUser.name || otherUser.username
                const isStarting = startingUserId === otherUser.id

                return (
                  <button
                    key={otherUser.id}
                    type="button"
                    onClick={() => handleSelect(otherUser.id)}
                    disabled={startingUserId !== null}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700"
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        @{otherUser.username}
                      </span>
                    </span>
                    {isStarting ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="size-4 shrink-0 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default NewConversationModal

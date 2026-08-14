import { useEffect, useMemo, useState } from 'react'

const NewConversationModal = ({
  users,
  onSelect,
  onCreateGroup,
  onClose
}) => {
  const [mode, setMode] = useState('direct')
  const [query, setQuery] = useState('')
  const [startingUserId, setStartingUserId] = useState(null)
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [creatingGroup, setCreatingGroup] = useState(false)

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

  const toggleGroupMember = userId => {
    setSelectedUserIds(currentIds =>
      currentIds.includes(userId)
        ? currentIds.filter(id => id !== userId)
        : currentIds.concat(userId)
    )
  }

  const handleCreateGroup = async event => {
    event.preventDefault()

    if (
      mode !== 'group' ||
      !groupName.trim() ||
      selectedUserIds.length < 2
    ) {
      return
    }

    setCreatingGroup(true)
    const succeeded = await onCreateGroup(
      groupName.trim(),
      selectedUserIds
    )

    if (succeeded) {
      onClose()
      return
    }

    setCreatingGroup(false)
  }

  const isBusy = startingUserId !== null || creatingGroup

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !isBusy) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
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
              Message someone or bring people together
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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

        <div className="shrink-0 px-4 pt-4 sm:px-5">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('direct')}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'direct'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Direct message
            </button>
            <button
              type="button"
              onClick={() => setMode('group')}
              disabled={isBusy}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === 'group'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create group
            </button>
          </div>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleCreateGroup}
        >
          {mode === 'group' && (
            <div className="shrink-0 px-4 pt-4 sm:px-5">
              <label
                htmlFor="group-name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Group name
              </label>
              <input
                id="group-name"
                type="text"
                value={groupName}
                onChange={event => setGroupName(event.target.value)}
                placeholder="For example: Study group"
                maxLength="60"
                disabled={creatingGroup}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                autoFocus
              />
            </div>
          )}

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
                disabled={isBusy}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                autoFocus={mode === 'direct'}
              />
            </div>
          </div>

          <div className="chat-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
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
                  const isSelected = selectedUserIds.includes(otherUser.id)

                  return (
                    <button
                      key={otherUser.id}
                      type="button"
                      onClick={() => mode === 'group'
                        ? toggleGroupMember(otherUser.id)
                        : handleSelect(otherUser.id)}
                      disabled={isBusy}
                      aria-pressed={mode === 'group' ? isSelected : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60 ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-100'
                      }`}
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
                      ) : mode === 'group' ? (
                        <span
                          aria-hidden="true"
                          className={`flex size-5 items-center justify-center rounded-md border ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="size-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                            </svg>
                          )}
                        </span>
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

          {mode === 'group' && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
              <span className="text-xs text-slate-500">
                {selectedUserIds.length < 2
                  ? `Select ${2 - selectedUserIds.length} more ${
                      selectedUserIds.length === 1 ? 'member' : 'members'
                    }`
                  : `${selectedUserIds.length} members selected`}
              </span>
              <button
                type="submit"
                disabled={
                  creatingGroup ||
                  !groupName.trim() ||
                  selectedUserIds.length < 2
                }
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {creatingGroup && (
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {creatingGroup ? 'Creating…' : 'Create group'}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  )
}

export default NewConversationModal

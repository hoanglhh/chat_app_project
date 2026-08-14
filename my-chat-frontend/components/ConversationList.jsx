const ConversationList = ({
  conversations,
  currentUserId,
  selectedConversationId,
  onSelect
}) => {
  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center">
        <p className="text-sm font-medium text-slate-700">No conversations yet</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Use the new conversation button to find someone.
        </p>
      </div>
    )
  }

  return (
    <nav className="space-y-1" aria-label="Conversations">
      {conversations.map(conversation => {
        const isAiConversation = conversation.type === 'ai'
        const isGroupConversation = conversation.type === 'group'
        const otherParticipant = conversation.participants.find(
          participant => participant.id !== currentUserId
        )

        if (!isAiConversation && !isGroupConversation && !otherParticipant) {
          return null
        }

        const displayName = isAiConversation
          ? conversation.name || 'Gemini'
          : isGroupConversation
            ? conversation.name || 'Group conversation'
            : otherParticipant.name || otherParticipant.username
        const initial = displayName.charAt(0).toUpperCase()
        const isSelected = conversation.id === selectedConversationId

        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect(conversation.id)}
            aria-pressed={isSelected}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSelected
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                isSelected
                  ? 'bg-white/20 text-white'
                  : isAiConversation
                    ? 'bg-violet-100 text-violet-700'
                    : isGroupConversation
                      ? 'bg-emerald-100 text-emerald-700'
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
              ) : initial}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {displayName}
              </span>
              <span
                className={`block truncate text-xs ${
                  isSelected ? 'text-blue-100' : 'text-slate-500'
                }`}
              >
                {isAiConversation
                  ? 'AI assistant'
                  : isGroupConversation
                    ? `${conversation.participants.length} members`
                    : `@${otherParticipant.username}`}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default ConversationList

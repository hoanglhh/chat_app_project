const ConversationList = ({
  conversations,
  currentUserId,
  selectedConversationId,
  onSelect
}) => {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        Conversations
      </h2>

      <div className="flex gap-2 overflow-x-auto">
        {conversations.map(conversation => {
          const otherParticipant = conversation.participants.find(
            participant => participant.id !== currentUserId
          )

          if (!otherParticipant) {
            return null
          }

          const isSelected =
            conversation.id === selectedConversationId

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={
                isSelected
                  ? 'shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
                  : 'shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200'
              }
            >
              {otherParticipant.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ConversationList
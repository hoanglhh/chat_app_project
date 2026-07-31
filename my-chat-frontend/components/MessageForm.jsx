const MessageForm = ({ name, content, addMessage, handleContentChange, handleNameChange, sending, saving, isEditing, cancelEditing }) => {
  const cannotSend = sending || saving || content.trim() === '' || name.trim() === ''

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (cannotSend) {
        return
      }
      event.currentTarget.form.requestSubmit()
    }
  }

  return (
    <form
      className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-4"
      onSubmit={addMessage}
    >
      {isEditing && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <span className="truncate">Editing message</span>
          <button
            type="button"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={cancelEditing}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="name" className="shrink-0 text-xs text-slate-500">
          Sending as
        </label>
        <input
          id="name"
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:max-w-48"
          value={name}
          onChange={handleNameChange}
          placeholder="Your name"
          autoComplete="name"
        />
      </div>

      <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <label htmlFor="content" className="sr-only">
          Message
        </label>
        <textarea
          id="content"
          className="max-h-36 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={isEditing ? 'Update your message…' : 'Write a message…'}
          rows="1"
        />
        <button
          type="submit"
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-4"
          disabled={cannotSend}
        >
          <span>
            {saving
              ? 'Saving…'
              : sending
                ? 'Sending…'
                : isEditing
                  ? 'Save'
                  : 'Send'}
          </span>
          {sending || saving ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg
              aria-hidden="true"
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6 12 3.269 3.269L18 6.75"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="mt-2 hidden text-xs text-slate-400 sm:block">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  )
}

export default MessageForm

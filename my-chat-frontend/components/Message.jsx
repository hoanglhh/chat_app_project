import { useEffect, useRef, useState } from "react"

const Message = ({ message, handleDelete, currentName, startEditing }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState('top')
  const menuRef = useRef(null)
  const isOwnMessage = message.name === currentName.trim()
  const createdAt = new Date(message.createdAt)
  const formattedTime = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [isMenuOpen])

  const toggleMenu = () => {
    if (!isMenuOpen) {
      const menuPosition = menuRef.current?.getBoundingClientRect()
      const scrollAreaPosition = menuRef.current
        ?.closest('.chat-scrollbar')
        ?.getBoundingClientRect()

      if (menuPosition && scrollAreaPosition) {
        const spaceAbove = menuPosition.top - scrollAreaPosition.top
        setMenuPlacement(spaceAbove < 120 ? 'bottom' : 'top')
      }
    }

    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <li className={`flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <article
        className={`flex max-w-[85%] flex-col sm:max-w-[72%] ${
          isOwnMessage ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`mb-1 flex items-center gap-1.5 px-1 text-xs ${
            isOwnMessage ? 'flex-row-reverse text-slate-500' : 'text-slate-500'
          }`}
        >
          <strong className="font-medium text-slate-700">
            {isOwnMessage ? 'You' : message.name}
          </strong>
          {formattedTime && (
            <>
              <span aria-hidden="true">·</span>
              <time
                dateTime={message.createdAt}
                title={createdAt.toLocaleString()}
              >
                {formattedTime}
              </time>
            </>
          )}
        </div>

        <div
          className={`flex items-center gap-1.5 ${
            isOwnMessage ? 'flex-row-reverse' : ''
          }`}
        >
          <p
            className={`max-w-full whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-6 sm:text-[15px] ${
              isOwnMessage
                ? 'rounded-2xl rounded-br-md bg-blue-600 text-white'
                : 'rounded-2xl rounded-bl-md bg-slate-100 text-slate-800'
            }`}
          >
            {message.content}
          </p>

          {isOwnMessage && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={toggleMenu}
                aria-label="Open message actions"
                aria-expanded={isMenuOpen}
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 3.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM10 11.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM10 18.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
                </svg>
              </button>

              {isMenuOpen && (
                <div
                  className={`absolute right-0 z-30 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg ${
                    menuPlacement === 'bottom' ? 'top-9' : 'bottom-9'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      startEditing(message)
                      setIsMenuOpen(false)
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="w-full rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleDelete(message.id)
                      setIsMenuOpen(false)
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  )
}

export default Message

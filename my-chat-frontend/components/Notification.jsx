const Notification = ({ notification = {} }) => {
  const { message } = notification || {}

  if (!message) {
    return null
  }

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:mx-6"
    >
      <span aria-hidden="true" className="font-semibold">!</span>
      <span className="leading-5">{message}</span>
    </div>
  )
}

export default Notification

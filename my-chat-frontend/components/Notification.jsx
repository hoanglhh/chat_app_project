const Notification = ({ notification = {} }) => {
  const { message, type = 'error' } = notification || {}
  const isSuccess = type === 'success'

  if (!message) {
    return null
  }

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`mx-4 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm sm:mx-6 ${
        isSuccess
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      <span aria-hidden="true" className="font-semibold">
        {isSuccess ? '✓' : '!'}
      </span>
      <span className="leading-5">{message}</span>
    </div>
  )
}

export default Notification

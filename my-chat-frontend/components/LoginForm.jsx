const LoginForm = ({ username, password, setUsername, setPassword, handleLogin }) => {
  return (
    <form className="space-y-5" onSubmit={handleLogin}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Welcome back
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Log in to continue the conversation.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="login-username"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Username
          </label>
          <input
            id="login-username"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            type="text"
            value={username}
            onChange={({ target }) => setUsername(target.value)}
            autoComplete="username"
            placeholder="Your username"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="login-password"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            type="password"
            value={password}
            onChange={({ target }) => setPassword(target.value)}
            autoComplete="current-password"
            placeholder="Your password"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Log in
      </button>
    </form>
  )
}

export default LoginForm

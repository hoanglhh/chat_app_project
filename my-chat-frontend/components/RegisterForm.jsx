const RegisterForm = ({ username, name, password, setUsername, setName, setPassword, handleRegister }) => {
  return (
    <form className="space-y-5" onSubmit={handleRegister}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          Create an account
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="register-name"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Your name
          </label>
          <input
            id="register-name"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            type="text"
            value={name}
            onChange={({ target }) => setName(target.value)}
            autoComplete="name"
            placeholder="What should people call you?"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="register-username"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Username
          </label>
          <input
            id="register-username"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            type="text"
            value={username}
            onChange={({ target }) => setUsername(target.value)}
            autoComplete="username"
            placeholder="At least 3 characters"
            minLength="3"
            required
          />
        </div>

        <div>
          <label
            htmlFor="register-password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="register-password"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-100"
            type="password"
            value={password}
            onChange={({ target }) => setPassword(target.value)}
            autoComplete="new-password"
            placeholder="At least 3 characters"
            minLength="3"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Create account
      </button>
    </form>
  )
}

export default RegisterForm

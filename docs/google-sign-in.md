# Google OAuth 2.0 / OpenID Connect

The existing `/api/users`, `/api/conversations`, and message endpoints form the
app's REST-style API. Password login already issued an app JWT; that alone
was not an OAuth or OpenID Connect implementation. Google sign-in now makes
the backend an OpenID Connect relying party using OAuth 2.0's authorization
code flow with S256 PKCE.

The frontend opens a Google login popup. The backend creates a ten-minute,
single-use login transaction bound to an HttpOnly browser cookie, then
redirects to Google. It validates state, nonce, issuer, audience, expiry, and
the ID-token signature using Google's discovery metadata and signing keys.
The callback returns the normal app JWT through an origin-checked popup
message. App JWTs and provider tokens are never placed in redirect URLs.
REST requests and Socket.IO continue using the app JWT as before.

## Configure your Google web client

1. Open [Google Cloud OAuth clients](https://console.cloud.google.com/auth/clients)
   and choose the Google Cloud project for this app. Set up the Google Auth
   Platform branding, audience, and contact details if prompted.
2. Create an OAuth client of type **Web application**. While the app is in
   testing mode, add the Google accounts allowed to test it under Audience.
3. Add the exact authorized redirect URIs for the environments you use:

   ```text
   http://localhost:3001/api/auth/google/callback
   https://chat-app-project-mbq1.onrender.com/api/auth/google/callback
   ```

4. Set the following in `my-chat-backend/.env` for local use:

   ```env
   GOOGLE_CLIENT_ID=your_web_client_id
   GOOGLE_CLIENT_SECRET=your_web_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
   FRONTEND_URL=http://localhost:5173
   ```

5. On Render, put the credentials in the **backend** environment and use:

   ```env
   GOOGLE_REDIRECT_URI=https://chat-app-project-mbq1.onrender.com/api/auth/google/callback
   FRONTEND_URL=https://chat-app-project-frontend-wmxo.onrender.com
   ```

6. Restart/redeploy the backend and frontend. Keep `VITE_API_BASE_URL` pointed
   at that same backend origin. Open the frontend using the exact origin in
   `FRONTEND_URL`; `localhost` and `127.0.0.1` are different origins. Allow the
   sign-in popup if your browser blocks it.

The client secret belongs only on the backend, never in chat, Git, or a
`VITE_` variable. The Gemini API key is separate from these OAuth credentials.
Google sign-in stays hidden when configuration is absent or invalid; password
login continues working. Use a current Node.js runtime supported by the
existing Vite/Mongoose dependencies (the integration was tested on Node 26).

## Account behavior

Google's stable subject identifies the app profile. Repeated Google logins
reuse that profile. A first Google login creates a generated username and uses
Google's display name. Google-only users have no password hash. Existing local
profiles and conversations are unchanged; accounts are not automatically
linked by email, username, or display name. Signing out ends the app session;
it does not sign the user out of Google. The app requests only `openid profile`
and does not store Google access tokens or request refresh tokens.

## Tests

Run `npm test` in the backend with a dedicated `TEST_MONGODB_URI`, `SECRET`,
and a placeholder `GEMINI_API_KEY` if no local environment file is configured.
The Google tests simulate discovery, token, and signing-key HTTP responses
and validate real RSA-signed ID tokens. They do not contact Google or require
real OAuth credentials.

Run `npm test` in the frontend after installing Playwright's Chromium browser.
The suite exercises popup success, cancellation, blocked/closed windows,
origin/source rejection, competing login responses, and password login.
Live Google sign-in still needs the registered web client above.

Sources: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect),
[OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html),
[OAuth security best practices](https://www.rfc-editor.org/rfc/rfc9700.html).

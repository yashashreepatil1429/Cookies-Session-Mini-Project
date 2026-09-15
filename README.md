# Cookie Jar: Node.js Cookies & Sessions

A small login/logout application showing the relationship between browser cookies and server-side sessions.

## Run it

```bash
npm start
```

Open http://localhost:3000.

Demo credentials:

- Email: `demo@example.com`
- Password: `cookiejar`

## How it works

- `POST /api/login` validates the demo credentials, creates a random session ID, and stores the user session in server memory.
- The server sends the ID in an `HttpOnly`, `SameSite=Lax` cookie named `sid`.
- `GET /api/session` looks up the cookie and returns the current user without exposing the session ID to JavaScript.
- `POST /api/logout` deletes the server session and expires the cookie.

Sessions are intentionally in memory for learning. Restarting the Node process clears all sessions, and production applications should use a shared session store and a real password hash.

## Frontend-to-backend flow

The cookie and the session work together, but they are different things:

- **Cookie:** stored by the browser. This app stores only the random `sid` value in the cookie.
- **Session:** stored by Node.js in the server-side `sessions` map. It contains the user and expiration time.

### 1. The frontend checks for an existing session

When the page loads, `public/app.js` sends:

```text
GET /api/session
```

The browser automatically includes the `sid` cookie, if one exists. The backend reads the cookie, finds the matching session in its `Map`, checks that it has not expired, and returns either:

```json
{"authenticated":true,"user":{"email":"demo@example.com","name":"Demo Member"}}
```

or:

```json
{"authenticated":false,"user":null}
```

The frontend uses that response to show the signed-in or signed-out view.

### 2. Login creates both records

When the user submits the login form, the frontend sends the credentials as JSON:

```text
POST /api/login
Content-Type: application/json

{"email":"demo@example.com","password":"cookiejar"}
```

The backend validates the credentials. If they are correct, it:

1. Generates a cryptographically random session ID.
2. Stores the session ID and user data in the server-side `sessions` map.
3. Sends a `Set-Cookie` response header containing the session ID.

The cookie is configured as `HttpOnly; SameSite=Lax; Path=/` and lasts for eight hours. Because it is `HttpOnly`, frontend JavaScript cannot read the session ID. The browser stores it and sends it automatically with later requests.

The login response also includes the user object, so the frontend can immediately render the authenticated view.

### 3. Refreshing the page reuses the session

The frontend never stores the user or session ID in local storage. After a refresh, it calls `GET /api/session` again. The browser sends `sid`, and the backend uses that value to recover the server-side session and return the user.

The session expires after eight hours. Expired sessions are rejected during lookup and periodically removed from memory.

### 4. Logout removes both sides of the relationship

When the user clicks **Log out**, the frontend sends:

```text
POST /api/logout
```

The backend reads the `sid` cookie, deletes the matching entry from the `sessions` map, and returns a replacement cookie with `Max-Age=0`. That tells the browser to remove its cookie. A later `GET /api/session` therefore returns `authenticated: false`.

## Request summary

| Request | Frontend action | Backend action | Cookie/session result |
| --- | --- | --- | --- |
| `GET /api/session` | Check login state | Read `sid` and find session | Returns current user or logged-out state |
| `POST /api/login` | Send email and password | Validate and create session | Sends a new `sid` cookie |
| `POST /api/logout` | Ask to sign out | Delete session | Expires the `sid` cookie |
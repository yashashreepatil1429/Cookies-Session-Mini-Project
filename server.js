const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const DEMO_USER = { email: 'demo@example.com', password: 'cookiejar' };
const sessions = new Map();
const publicDir = path.join(__dirname, 'public');

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(body);
}

function sendFile(response, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    response.end(content);
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) request.destroy();
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

function currentSession(request) {
  const sessionId = parseCookies(request).sid;
  const session = sessionId && sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    return null;
  }
  return { id: sessionId, ...session };
}

function sessionCookie(sessionId, maxAge) {
  return `sid=${encodeURIComponent(sessionId)}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/`;
}

setInterval(() => {
  for (const [id, session] of sessions) {
    if (session.expiresAt < Date.now()) sessions.delete(id);
  }
}, 60_000).unref();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const session = currentSession(request);
    sendJson(response, 200, { authenticated: Boolean(session), user: session?.user || null });
    return;
  }

  if (url.pathname === '/api/login' && request.method === 'POST') {
    try {
      const { email, password } = await readBody(request);
      if (email !== DEMO_USER.email || password !== DEMO_USER.password) {
        sendJson(response, 401, { error: 'That email and password combination is not recognized.' });
        return;
      }

      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, {
        user: { email: DEMO_USER.email, name: 'Demo Member' },
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS
      });
      sendJson(response, 200, { message: 'Signed in', user: { email: DEMO_USER.email, name: 'Demo Member' } }, {
        'Set-Cookie': sessionCookie(sessionId, SESSION_TTL_MS / 1000)
      });
    } catch {
      sendJson(response, 400, { error: 'Please send a valid login request.' });
    }
    return;
  }

  if (url.pathname === '/api/logout' && request.method === 'POST') {
    const sessionId = parseCookies(request).sid;
    if (sessionId) sessions.delete(sessionId);
    sendJson(response, 200, { message: 'Signed out' }, { 'Set-Cookie': sessionCookie('', 0) });
    return;
  }

  if (request.method === 'GET') {
    const files = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8']
    };
    const file = files[url.pathname];
    if (file) {
      sendFile(response, path.join(publicDir, file[0]), file[1]);
      return;
    }
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Cookie & Session app running at http://localhost:${PORT}`);
});

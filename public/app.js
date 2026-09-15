const loginForm = document.querySelector('#login-form');
const logoutButton = document.querySelector('#logout-button');
const signedIn = document.querySelector('#signed-in');
const message = document.querySelector('#message');
const panelTitle = document.querySelector('#panel-title');
const panelCopy = document.querySelector('#panel-copy');

function showAuthenticated(user) {
  loginForm.hidden = true;
  signedIn.hidden = false;
  panelTitle.textContent = 'You are in.';
  panelCopy.textContent = 'The server found your session. Refresh this page and the cookie will bring you right back.';
  document.querySelector('#user-name').textContent = user.name;
  document.querySelector('#user-email').textContent = user.email;
  message.textContent = '';
}

function showLoggedOut() {
  loginForm.hidden = false;
  signedIn.hidden = true;
  panelTitle.textContent = 'Welcome back';
  panelCopy.textContent = 'Sign in to create a fresh server session. Your browser receives only a session ID.';
}

async function request(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const submitButton = loginForm.querySelector('button');
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Checking...';
  try {
    const data = await request('/api/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) });
    showAuthenticated(data.user);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Open the jar';
  }
});

logoutButton.addEventListener('click', async () => {
  await request('/api/logout', { method: 'POST' });
  showLoggedOut();
});

request('/api/session', { method: 'GET' }).then((data) => {
  if (data.authenticated) showAuthenticated(data.user);
}).catch(() => {
  message.textContent = 'The server is unavailable. Start the app and refresh.';
});

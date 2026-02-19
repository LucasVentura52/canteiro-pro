const TOKEN_KEY = 'canteiro_pro_auth_token';
const USER_KEY = 'canteiro_pro_auth_user';
const LEGACY_TOKEN_KEYS = ['pedreiro_auth_token', 'auth_token'];
const LEGACY_USER_KEYS = ['pedreiro_auth_user', 'auth_user'];

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignora falha de quota/storage bloqueado.
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignora falha de quota/storage bloqueado.
  }
}

function readLegacyValue(keys) {
  for (const key of keys) {
    const value = storageGet(key);
    if (value) return { key, value };
  }

  return null;
}

function migrateLegacyIfNeeded() {
  const currentToken = storageGet(TOKEN_KEY);
  const currentUser = storageGet(USER_KEY);

  if (!currentToken) {
    const legacyToken = readLegacyValue(LEGACY_TOKEN_KEYS);
    if (legacyToken?.value) {
      storageSet(TOKEN_KEY, legacyToken.value);
      storageRemove(legacyToken.key);
    }
  }

  if (!currentUser) {
    const legacyUser = readLegacyValue(LEGACY_USER_KEYS);
    if (legacyUser?.value) {
      storageSet(USER_KEY, legacyUser.value);
      storageRemove(legacyUser.key);
    }
  }
}

export function saveSession(token, user) {
  if (token) {
    storageSet(TOKEN_KEY, token);
  } else {
    storageRemove(TOKEN_KEY);
  }

  storageSet(USER_KEY, JSON.stringify(user || {}));
}

export function getToken() {
  migrateLegacyIfNeeded();
  return storageGet(TOKEN_KEY);
}

export function getUser() {
  migrateLegacyIfNeeded();

  const raw = storageGet(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  storageRemove(TOKEN_KEY);
  storageRemove(USER_KEY);
  LEGACY_TOKEN_KEYS.forEach(storageRemove);
  LEGACY_USER_KEYS.forEach(storageRemove);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

const AUTH_TOKEN_STORAGE_KEY = 'edusmart_auth_token';

function readStoredToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
  return null;
}

let inMemoryToken: string | null = readStoredToken();
let firebaseTokenProvider: ((forceRefresh?: boolean) => Promise<string | null>) | null = null;

export function setMemoryAuthToken(token: string | null) {
  inMemoryToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function setFirebaseTokenProvider(
  provider: ((forceRefresh?: boolean) => Promise<string | null>) | null
) {
  firebaseTokenProvider = provider;
}

export async function getActiveAuthToken(forceRefresh = false): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const persisted = readStoredToken();
  if (persisted) {
    inMemoryToken = persisted;
    return persisted;
  }
  if (firebaseTokenProvider) {
    return await firebaseTokenProvider(forceRefresh);
  }
  return null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const executeFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { ...options, headers });
  };

  const initialToken = await getActiveAuthToken(false);
  let res = await executeFetch(initialToken);

  // If Firebase ID token expired right before request, refresh once and retry
  if (res.status === 401 && !inMemoryToken && firebaseTokenProvider) {
    const refreshedToken = await firebaseTokenProvider(true);
    if (refreshedToken) {
      res = await executeFetch(refreshedToken);
    }
  } else if (res.status === 401 && inMemoryToken && path === '/api/auth/me') {
    setMemoryAuthToken(null);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

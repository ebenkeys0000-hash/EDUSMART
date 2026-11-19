let inMemoryToken: string | null = null;
let firebaseTokenProvider: (() => Promise<string | null>) | null = null;

export function setMemoryAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function setFirebaseTokenProvider(provider: (() => Promise<string | null>) | null) {
  firebaseTokenProvider = provider;
}

export async function getActiveAuthToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  if (firebaseTokenProvider) {
    return await firebaseTokenProvider();
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
  const token = await getActiveAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

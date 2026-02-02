const API = typeof window === 'undefined' ? '' : '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token: t, ...init } = opts;
  const token = t ?? getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn(`[API] No token found for request to ${path}`);
  }
  
  const url = `${API}${path}`;

  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  
  if (!res.ok) {
    // Read body once (can only be consumed once)
    let errorText = '';
    try {
      errorText = await res.text();
    } catch {
      errorText = '(could not read response body)';
    }
    let errorData: any = {};
    if (errorText.trim()) {
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
    }
    const errorMessage = (errorData?.message ?? errorData?.error ?? errorText) || res.statusText;
    console.error(`[API ERROR] ${res.status} ${res.statusText} on ${path}:`, (errorData?.message ?? errorData?.error ?? errorText) || '(no error details)');
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export type User = { id: string; username: string; timezone: string };
export type Service = { id: string; name: string };
export type Team = { id: string; name: string; colorHex: string };
export type Customer = { id: string; fullName: string; address: string; phone: string };
export type TaskOccurrence = {
  taskId: string;
  occurrenceStart: string;
  occurrenceEnd: string;
  customerName: string;
  customerId: string | null;
  address: string | null;
  phone: string | null;
  serviceId: string | null;
  service: Service | null;
  servicePriceCents: number | null;
  description: string | null;
  notes: string | null;
  allDay: boolean;
  assignedTeamId: string | null;
  assignedTeam: Team | null;
  createdById: string;
  createdBy: { id: string; username: string };
  rrule: string | null;
};

export type TaskRecord = {
  id: string;
  customerName: string;
  customerId: string | null;
  address: string | null;
  phone: string | null;
  serviceId: string | null;
  service: Service | null;
  servicePriceCents: number | null;
  description: string | null;
  notes: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  assignedTeamId: string | null;
  assignedTeam: Team | null;
  createdById: string;
  createdBy: { id: string; username: string };
  rrule: string | null;
};

export const auth = {
  login: (username: string, password: string) =>
    api<{ accessToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  refresh: () =>
    api<{ user: User | null }>('/api/auth/refresh', { method: 'POST' }),
  logout: () => api<{ message: string }>('/api/auth/logout', { method: 'POST' }),
};

export const users = {
  me: () => api<User | null>('/api/me'),
  updateTimezone: (timezone: string) =>
    api<User>('/api/me/timezone', {
      method: 'PATCH',
      body: JSON.stringify({ timezone }),
    }),
  list: () => api<User[]>('/api/users'),
  create: (username: string, password: string, timezone?: string) =>
    api<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, timezone }),
    }),
};

export const services = {
  list: () => api<Service[]>('/api/services'),
  create: (name: string) =>
    api<Service>('/api/services', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  update: (id: string, d: Partial<Service>) =>
    api<Service>(`/api/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    }),
  delete: (id: string) =>
    api<void>(`/api/services/${id}`, { method: 'DELETE' }),
};

export const teams = {
  list: () => api<Team[]>('/api/teams'),
  create: (name: string, colorHex: string) =>
    api<Team>('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ name, colorHex }),
    }),
  update: (id: string, d: Partial<Team>) =>
    api<Team>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    }),
  delete: (id: string) =>
    api<void>(`/api/teams/${id}`, { method: 'DELETE' }),
};

export const customers = {
  list: (query?: string) =>
    api<Customer[]>(`/api/customers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  get: (id: string) => api<Customer>(`/api/customers/${id}`),
  create: (fullName: string, address: string, phone: string) =>
    api<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ fullName, address, phone }),
    }),
  update: (id: string, d: Partial<Customer>) =>
    api<Customer>(`/api/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    }),
  delete: (id: string) =>
    api<void>(`/api/customers/${id}`, { method: 'DELETE' }),
};

export type SuggestCustomer = {
  customerId: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export type CalendarSearchResponse = {
  items: TaskOccurrence[];
  nextCursor: string | null;
};

export const calendarSearchSuggest = (q: string, opts?: { signal?: AbortSignal }) => {
  const params = new URLSearchParams({ q: q.trim() });
  return api<{ customers: SuggestCustomer[] }>(
    `/api/search/suggest?${params.toString()}`,
    { signal: opts?.signal }
  );
};

export const calendarSearch = (
  opts: {
    query?: string;
    customerId?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
    signal?: AbortSignal;
  }
) => {
  const now = new Date();
  const from =
    opts.from ??
    new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
  const to =
    opts.to ??
    new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ from, to, limit: String(limit) });
  if (opts.customerId?.trim()) {
    params.set('customerId', opts.customerId.trim());
  }
  if (opts.query?.trim()) {
    params.set('query', opts.query.trim());
  }
  if (opts.cursor != null && opts.cursor !== '') {
    params.set('cursor', opts.cursor);
  }
  return api<CalendarSearchResponse>(`/api/search?${params.toString()}`, {
    signal: opts.signal,
  });
};

export const tasks = {
  list: (from: string, to: string) =>
    api<TaskOccurrence[]>(`/api/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  get: (id: string) => api<TaskRecord>(`/api/tasks/${id}`),
  create: (d: {
    customerName: string;
    customerId?: string;
    phone?: string;
    serviceId?: string;
    servicePriceCents?: number;
    address?: string;
    description?: string;
    notes?: string;
    startAt: string;
    endAt: string;
    allDay?: boolean;
    assignedTeamId?: string;
    rrule?: string;
  }) => api<unknown>('/api/tasks', { method: 'POST', body: JSON.stringify(d) }),
  update: (id: string, d: Record<string, unknown>, scope?: 'single' | 'following' | 'all', occurrenceStart?: string) => {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (occurrenceStart) params.set('occurrenceStart', occurrenceStart);
    const query = params.toString();
    return api<unknown>(`/api/tasks/${id}${query ? `?${query}` : ''}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    });
  },
  delete: (id: string, scope?: 'single' | 'following', occurrenceStart?: string) => {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (occurrenceStart) params.set('occurrenceStart', occurrenceStart);
    const query = params.toString();
    const url = `/api/tasks/${id}${query ? `?${query}` : ''}`;
    console.log(`[DELETE TASK] ${url}`, { scope, occurrenceStart });
    return api<{ ok: boolean; id: string; deleted: boolean; changed: number }>(url, { method: 'DELETE' });
  },
};

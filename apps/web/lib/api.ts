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
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message ?? res.statusText);
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
  update: (id: string, d: Record<string, unknown>) =>
    api<unknown>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(d),
    }),
  delete: (id: string) =>
    api<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

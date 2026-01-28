'use client';

import { useEffect, useState } from 'react';
import { users } from '@/lib/api';
import type { User } from '@/lib/api';

export default function SettingsUsersPage() {
  const [list, setList] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    users.list().then(setList).catch(() => setList([]));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await users.create(username, password, timezone);
      setSuccess(`User "${username}" created.`);
      setUsername('');
      setPassword('');
      setList(await users.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-gray-600">
        Create new users. All users have full access (everyone sees and manages all tasks).
      </p>

      <div className="mb-8 max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-medium text-gray-800">Create user</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Username *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Chicago"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-3 font-medium text-gray-800">Existing users</h2>
        <ul className="space-y-2">
          {list.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-4 rounded border border-gray-200 bg-white px-4 py-2"
            >
              <span className="font-medium text-gray-800">{u.username}</span>
              <span className="text-sm text-gray-500">{u.timezone}</span>
            </li>
          ))}
          {list.length === 0 && (
            <li className="text-sm text-gray-500">No users yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

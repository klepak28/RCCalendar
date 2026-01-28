'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/api';
import type { User } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) {
      router.replace('/');
      return;
    }
    auth
      .refresh()
      .then(({ user: u }) => {
        if (u) setUser(u);
        else router.replace('/');
      })
      .catch(() => router.replace('/'))
      .finally(() => setReady(true));
  }, [router]);

  async function handleLogout() {
    try {
      await auth.logout();
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/');
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/calendar" className="text-lg font-semibold text-gray-800">
            Raccoon Cleaning
          </Link>
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link
              href="/calendar"
              className={`rounded px-2 py-1 ${pathname === '/calendar' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Calendar
            </Link>
            <Link
              href="/settings/services"
              className={`rounded px-2 py-1 ${pathname === '/settings/services' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Settings → Services
            </Link>
            <Link
              href="/settings/teams"
              className={`rounded px-2 py-1 ${pathname === '/settings/teams' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Settings → Teams
            </Link>
            <Link
              href="/settings/users"
              className={`rounded px-2 py-1 ${pathname === '/settings/users' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Settings → Users
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{user?.username ?? '—'}</span>
          <button
            onClick={handleLogout}
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

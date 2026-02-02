'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { auth } from '@/lib/api';
import type { User } from '@/lib/api';
import HeaderSearchBox from './components/HeaderSearchBox';

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
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2 shadow-sm sm:gap-4">
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
              href="/customers"
              className={`rounded px-2 py-1 ${pathname === '/customers' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Add Customer
            </Link>
            <Link
              href="/settings"
              className={`rounded px-2 py-1 ${pathname?.startsWith('/settings') ? 'bg-gray-100 font-medium' : 'hover:bg-gray-100'}`}
            >
              Settings
            </Link>
          </nav>
        </div>
        <Suspense fallback={<div className="h-8 min-w-[220px] max-w-[320px] rounded-md border border-gray-200 bg-gray-50" />}>
          <HeaderSearchBox />
        </Suspense>
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

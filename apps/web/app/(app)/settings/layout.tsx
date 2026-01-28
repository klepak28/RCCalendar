'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: '/settings/services', label: 'Services' },
    { href: '/settings/teams', label: 'Teams' },
    { href: '/settings/users', label: 'Users' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800">Settings</h1>
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}

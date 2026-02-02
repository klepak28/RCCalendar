'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { calendarSearchSuggest, type SuggestCustomer } from '@/lib/api';

const SUGGEST_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function formatSecondaryLine(c: SuggestCustomer): string {
  const phone = c.phone?.trim();
  const address = c.address?.trim();
  if (phone && address) return `${phone} • ${address}`;
  return phone || address || '';
}

function dedupeByCustomerId(items: SuggestCustomer[]): SuggestCustomer[] {
  const seen = new Map<string, SuggestCustomer>();
  for (const item of items) {
    if (!seen.has(item.customerId)) {
      seen.set(item.customerId, item);
    }
  }
  return Array.from(seen.values());
}

export default function HeaderSearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestCustomer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const syncFromUrl = useCallback(() => {
    const q = searchParams.get('q') ?? '';
    setValue(q.trim());
    setIsOpen(false);
  }, [searchParams]);

  useEffect(() => {
    syncFromUrl();
  }, [pathname, syncFromUrl]);

  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setIsOpen(true);
      calendarSearchSuggest(query, { signal: abortRef.current?.signal })
        .then((data) => {
          const deduped = dedupeByCustomerId(data.customers);
          setSuggestions(deduped);
          setHighlightedIndex(0);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setSuggestions([]);
        })
        .finally(() => {
          setLoading(false);
          abortRef.current = null;
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0) {
        setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0) {
        setHighlightedIndex((i) => Math.max(0, i - 1));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) return;
      if (isOpen && suggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        const selected = suggestions[highlightedIndex];
        setIsOpen(false);
        router.push(`/calendar/search?customerId=${encodeURIComponent(selected.customerId)}`);
      } else {
        setIsOpen(false);
        router.push(`/calendar/search?q=${encodeURIComponent(trimmed)}`);
      }
    }
  };

  const handleSelectSuggestion = (customer: SuggestCustomer) => {
    setIsOpen(false);
    router.push(`/calendar/search?customerId=${encodeURIComponent(customer.customerId)}`);
  };

  const handleClear = () => {
    setValue('');
    setIsOpen(false);
  };

  const showDropdown = isOpen && value.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className="relative flex h-8 min-w-[220px] max-w-[420px] flex-1 flex-col sm:min-w-[280px] md:w-80 md:flex-initial md:min-w-0">
      <div className="flex h-8 flex-1 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5">
        <svg
          className="h-4 w-4 shrink-0 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => value.trim().length >= MIN_QUERY_LENGTH && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search (name, phone, address)"
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          aria-label="Search calendar"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="header-search-suggestions"
          aria-activedescendant={
            showDropdown && suggestions[highlightedIndex]
              ? `suggestion-${highlightedIndex}`
              : undefined
          }
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {showDropdown && (
        <div
          id="header-search-suggestions"
          className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500">Searching…</div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-3 text-center text-sm text-gray-500">No suggestions</div>
            ) : (
              suggestions.map((c, i) => {
                const secondary = formatSecondaryLine(c);
                return (
                  <div
                    key={c.customerId}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    className={`flex min-w-0 cursor-pointer flex-col justify-center px-4 py-2.5 text-left transition ${
                      i === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(c);
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                  >
                    <span className="truncate text-sm font-medium text-gray-800">{c.name}</span>
                    {secondary && (
                      <span className="truncate text-xs text-gray-500">{secondary}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-500">
            Press Enter for full search
          </div>
        </div>
      )}
    </div>
  );
}

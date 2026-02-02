'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, subDays, addYears, subYears } from 'date-fns';
import { calendarSearch, type TaskOccurrence } from '@/lib/api';

const OPEN_FOR_OCCURRENCE_KEY = 'calendar:openForOccurrence';
const PAGE_SIZE = 100;
const REQUEST_DEBOUNCE_MS = 500;

type TimeRangeKey = '30' | '90' | '365' | 'all';

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: '1 year' },
  { key: 'all', label: 'All' },
];

function getRangeFromKeyWithNow(
  key: TimeRangeKey,
  now: Date,
): { fromIso: string; toIso: string } {
  switch (key) {
    case '30':
      return {
        fromIso: subDays(now, 30).toISOString(),
        toIso: now.toISOString(),
      };
    case '90':
      return {
        fromIso: subDays(now, 90).toISOString(),
        toIso: now.toISOString(),
      };
    case '365':
      return {
        fromIso: subYears(now, 1).toISOString(),
        toIso: addYears(now, 1).toISOString(),
      };
    case 'all':
      return {
        fromIso: subYears(now, 10).toISOString(),
        toIso: addYears(now, 10).toISOString(),
      };
    default:
      return {
        fromIso: subYears(now, 1).toISOString(),
        toIso: addYears(now, 1).toISOString(),
      };
  }
}

function formatSearchTimeRange(o: TaskOccurrence): string {
  const start = parseISO(o.occurrenceStart);
  const end = parseISO(o.occurrenceEnd);
  const startStr = format(start, 'h:mm a');
  if (end.getTime() > start.getTime()) {
    return `${startStr} – ${format(end, 'h:mm a')}`;
  }
  return startStr;
}

export default function CalendarSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = (searchParams.get('customerId') ?? '').trim();
  const q = (searchParams.get('q') ?? '').trim();
  const searchByCustomerId = customerId.length > 0;

  const [timeRange, setTimeRange] = useState<TimeRangeKey>('365');
  const [items, setItems] = useState<TaskOccurrence[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowRef = useRef<Date | null>(null);
  if (nowRef.current === null) {
    nowRef.current = new Date();
  }
  const { fromIso, toIso } = useMemo(
    () => getRangeFromKeyWithNow(timeRange, nowRef.current!),
    [timeRange],
  );

  const lastRequestKeyRef = useRef<string>('');
  const lastRequestTimeRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollDoneRef = useRef(false);
  const targetRowRef = useRef<HTMLTableRowElement | null>(null);

  const fetchPage = useCallback(
    (cursor: string | null, append: boolean) => {
      if (!searchByCustomerId && !q) {
        setItems([]);
        setNextCursor(null);
        setLoading(false);
        return;
      }
      const requestKey = `${customerId}|${q}|${fromIso}|${toIso}|${cursor ?? ''}`;
      if (!append) {
        scrollDoneRef.current = false;
        const now = Date.now();
        if (
          lastRequestKeyRef.current === requestKey &&
          now - lastRequestTimeRef.current < REQUEST_DEBOUNCE_MS
        ) {
          return;
        }
        lastRequestKeyRef.current = requestKey;
        lastRequestTimeRef.current = now;
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
      }
      const controller = append ? setLoadingMore : setLoading;
      controller(true);
      setError(null);
      calendarSearch({
        customerId: searchByCustomerId ? customerId : undefined,
        query: q || undefined,
        from: fromIso,
        to: toIso,
        limit: PAGE_SIZE,
        cursor: cursor ?? undefined,
        signal: append ? undefined : abortRef.current?.signal,
      })
        .then((res) => {
          if (append) {
            setItems((prev) => [...prev, ...res.items]);
          } else {
            setItems(res.items);
          }
          setNextCursor(res.nextCursor);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
          if (!append) setItems([]);
        })
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
          if (!append) abortRef.current = null;
        });
    },
    [searchByCustomerId, customerId, q, fromIso, toIso],
  );

  useEffect(() => {
    if (!searchByCustomerId && !q) {
      setLoading(false);
      setItems([]);
      setNextCursor(null);
      return;
    }
    fetchPage(null, false);
  }, [searchByCustomerId, customerId, q, fromIso, toIso, fetchPage]);

  const todayStartLocal = useMemo(() => {
    const d = new Date(nowRef.current!);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  // First index where occurrenceStart >= today 00:00 local. List is ASC (old -> new).
  // Dev scenario: today=12th, visits on 11th and 17th -> firstFutureIndex=1, divider between them, scroll to row 1 (17th).
  const firstFutureIndex = useMemo(() => {
    if (items.length === 0) return -1;
    return items.findIndex(
      (o) => new Date(o.occurrenceStart).getTime() >= todayStartLocal,
    );
  }, [items, todayStartLocal]);

  const scrollTargetIndex =
    firstFutureIndex >= 0 ? firstFutureIndex : Math.max(0, items.length - 1);

  useEffect(() => {
    if (loading || items.length === 0 || scrollDoneRef.current) return;
    const el = targetRowRef.current;
    if (el) {
      scrollDoneRef.current = true;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [loading, items.length]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) fetchPage(nextCursor, true);
  };

  const handleRowClick = (occurrence: TaskOccurrence) => {
    const start = parseISO(occurrence.occurrenceStart);
    const dateStr = format(start, 'yyyy-MM-dd');
    try {
      sessionStorage.setItem(
        OPEN_FOR_OCCURRENCE_KEY,
        JSON.stringify(occurrence),
      );
    } catch {
      // ignore
    }
    router.push(
      `/calendar?date=${dateStr}&openTaskId=${encodeURIComponent(occurrence.taskId)}&occurrenceStart=${encodeURIComponent(occurrence.occurrenceStart)}`,
    );
  };

  if (!searchByCustomerId && !q) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/calendar"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to calendar
          </Link>
        </div>
        <p className="text-gray-600">Search from the calendar bar or use /calendar/search?q=Linda or ?customerId=...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/calendar"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            ← Back to calendar
          </Link>
          <h1 className="text-xl font-semibold text-gray-800">
            {searchByCustomerId ? 'Customer visits' : `Search results for "${q}"`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="time-range" className="text-sm text-gray-600">
            Time range:
          </label>
          <select
            id="time-range"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRangeKey)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center text-gray-500">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-6 py-12 text-center text-gray-600">
          No matches
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="w-8 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((o, i) => {
                  const start = parseISO(o.occurrenceStart);
                  const isScrollTarget = i === scrollTargetIndex;
                  return (
                    <React.Fragment key={`${o.taskId}-${o.occurrenceStart}`}>
                      {i === firstFutureIndex && firstFutureIndex >= 0 ? (
                        <tr className="bg-blue-50/80 border-y-2 border-blue-200">
                          <td
                            colSpan={5}
                            className="px-4 py-2 text-sm font-semibold text-blue-800"
                          >
                            Today
                          </td>
                        </tr>
                      ) : null}
                      <tr
                        ref={isScrollTarget ? targetRowRef : undefined}
                        onClick={() => handleRowClick(o)}
                        className="cursor-pointer transition hover:bg-blue-50/80"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="text-lg font-semibold text-gray-800">
                            {format(start, 'd')}
                          </div>
                          <div className="text-xs uppercase text-gray-500">
                            {format(start, 'MMM yyyy, EEE')}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                o.assignedTeam?.colorHex ?? '#6b7280',
                            }}
                            aria-hidden
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {formatSearchTimeRange(o)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {o.customerName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {o.address ?? '—'}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {firstFutureIndex === -1 && items.length > 0 ? (
                  <tr
                    key="today-divider-end"
                    className="bg-blue-50/80 border-y-2 border-blue-200"
                  >
                    <td
                      colSpan={5}
                      className="px-4 py-2 text-sm font-semibold text-blue-800"
                    >
                      Today
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  addDays,
  parseISO,
} from 'date-fns';
import { tasks, type TaskOccurrence } from '@/lib/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_PILLS = 3;

export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [occurrences, setOccurrences] = useState<TaskOccurrence[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const rangeStart = startOfMonth(viewDate);
  const rangeEnd = endOfMonth(viewDate);
  const rangeStartUtc = rangeStart;
  const rangeEndUtc = rangeEnd;

  const loadTasks = useCallback(() => {
    setLoading(true);
    console.log(`[LOAD TASKS] Fetching tasks from ${rangeStartUtc.toISOString()} to ${rangeEndUtc.toISOString()}`);
    tasks
      .list(rangeStartUtc.toISOString(), rangeEndUtc.toISOString())
      .then((occ) => {
        console.log(`[LOAD TASKS] Received ${occ.length} occurrences`);
        setOccurrences(occ);
      })
      .catch((err) => {
        console.error('[LOAD TASKS ERROR]', err);
        setOccurrences([]);
      })
      .finally(() => setLoading(false));
  }, [rangeStartUtc.toISOString(), rangeEndUtc.toISOString()]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const gridStart = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  function getOccurrencesForDay(day: Date): TaskOccurrence[] {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return occurrences.filter((o) => {
      const start = parseISO(o.occurrenceStart);
      return start >= dayStart && start <= dayEnd;
    });
  }

  function openDrawer(day: Date) {
    setSelectedDate(day);
    setDrawerOpen(true);
  }

  const selectedOccurrences = selectedDate
    ? getOccurrencesForDay(selectedDate)
    : [];

  const toDateValue = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) return;
    const picked = new Date(v + 'T12:00:00');
    if (!isNaN(picked.getTime())) {
      setViewDate(picked);
      setDatePickerOpen(false);
    }
  };

  return (
    <div className="min-h-screen p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              className="rounded-l-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Previous month"
            >
              Prev
            </button>
            <button
              onClick={() => setViewDate(new Date())}
              className="border-x border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Go to today"
            >
              Today
            </button>
            <button
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="rounded-r-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Next month"
            >
              Next
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDatePickerOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-lg font-semibold text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Pick date to jump to"
            >
              {format(viewDate, 'MMMM yyyy')}
              <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {datePickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDatePickerOpen(false)} aria-hidden />
                <div className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Jump to date</label>
                  <input
                    type="date"
                    value={toDateValue(viewDate)}
                    onChange={handleDatePickerChange}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <Link
          href="/settings"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Settings
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="border-r border-gray-200 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-gray-500">
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{ minHeight: 110 }}
            >
              {week.map((day) => {
                const occs = getOccurrencesForDay(day);
                const visible = occs.slice(0, MAX_PILLS);
                const more = occs.length - MAX_PILLS;
                const isCurrentMonth = isSameMonth(day, viewDate);
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => openDrawer(day)}
                    className={`day-cell cursor-pointer border-r border-b border-gray-100 last:border-r-0 transition hover:bg-gray-50/50 ${isToday(day) ? 'today' : ''} ${!isCurrentMonth ? 'bg-gray-50/60' : 'bg-white'}`}
                  >
                    <div
                      className={`mb-2 text-right text-sm ${!isCurrentMonth ? 'text-gray-400' : isToday(day) ? 'font-bold text-blue-600' : 'font-medium text-gray-700'}`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {visible.map((o) => (
                        <div
                          key={`${o.taskId}-${o.occurrenceStart}`}
                          className="task-pill truncate"
                          style={{
                            backgroundColor: o.assignedTeam?.colorHex ?? '#6b7280',
                          }}
                          title={o.customerName}
                        >
                          {o.customerName}
                        </div>
                      ))}
                      {more > 0 && (
                        <div className="truncate px-1 text-xs text-gray-500">
                          +{more} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {drawerOpen && selectedDate && (
        <DayDrawer
          date={selectedDate}
          occurrences={selectedOccurrences}
          onClose={() => setDrawerOpen(false)}
          onTaskChange={loadTasks}
        />
      )}
    </div>
  );
}

function DayDrawer({
  date,
  occurrences,
  onClose,
  onTaskChange,
}: {
  date: Date;
  occurrences: TaskOccurrence[];
  onClose: () => void;
  onTaskChange: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<TaskOccurrence | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingOccurrence, setDeletingOccurrence] = useState<TaskOccurrence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteClick = (occurrence: TaskOccurrence) => {
    setDeletingOccurrence(occurrence);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (scope: 'single' | 'following') => {
    if (!deletingOccurrence) return;

    setDeleting(true);
    try {
      // Ensure occurrenceStart is sent as UTC ISO string
      const occurrenceStartAt = deletingOccurrence.occurrenceStart; // Already ISO string from API
      console.log(`[DELETE] Deleting task ${deletingOccurrence.taskId} with scope=${scope}, occurrenceStart=${occurrenceStartAt}`);
      
      const result = await tasks.delete(
        deletingOccurrence.taskId,
        scope,
        occurrenceStartAt,
      );
      console.log(`[DELETE] Response:`, result);
      
      // Verify deletion was successful
      if (!result || (result as any).changed === 0) {
        throw new Error('Delete operation did not change any records');
      }
      
      console.log(`[DELETE] Success - task ${deletingOccurrence.taskId}, scope=${scope}, changed=${(result as any).changed}`);
      showToast('Task deleted', 'success');
      
      // Force refresh calendar data - ensure DB changes are visible
      // Small delay to ensure DB transaction is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      // Call onTaskChange which triggers loadTasks to refetch from API
      onTaskChange();
      setShowDeleteModal(false);
      setDeletingOccurrence(null);
    } catch (err) {
      console.error('[DELETE ERROR]', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete task', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteNonRecurring = async () => {
    if (!deletingOccurrence) return;

    if (!confirm('Delete this task?')) {
      return;
    }

    setDeleting(true);
    try {
      console.log(`[DELETE] Deleting non-recurring task ${deletingOccurrence.taskId}`);
      const result = await tasks.delete(deletingOccurrence.taskId);
      console.log(`[DELETE] Response:`, result);
      
      // Verify deletion was successful
      if (!result || (result as any).changed === 0) {
        throw new Error('Delete operation did not change any records');
      }
      
      console.log(`[DELETE] Success - task ${deletingOccurrence.taskId}, changed=${(result as any).changed}`);
      showToast('Task deleted', 'success');
      
      // Force refresh calendar data - ensure DB changes are visible
      // Small delay to ensure DB transaction is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      // Call onTaskChange which triggers loadTasks to refetch from API
      onTaskChange();
      setShowDeleteModal(false);
      setDeletingOccurrence(null);
    } catch (err) {
      console.error('[DELETE ERROR]', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete task', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-20 bg-black/30 backdrop-blur-[1px] transition"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed right-0 top-0 z-30 h-full w-full max-w-md border-l border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {format(date, 'EEEE, MMM d, yyyy')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-auto p-5">
          <button
            onClick={() => {
              setEditingOccurrence(null);
              setEditingId(null);
              setShowModal(true);
            }}
            className="mb-5 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add task
          </button>
          <ul className="space-y-3">
            {occurrences.map((o) => (
              <li
                key={`${o.taskId}-${o.occurrenceStart}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-800 truncate">
                    {o.customerName}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {o.service?.name ?? 'No service'} · {o.servicePriceCents !== null ? `$${(o.servicePriceCents / 100).toFixed(2)}` : '—'} · {o.phone ? `${o.phone} · ` : ''}{o.createdBy.username}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      setEditingOccurrence(o);
                      setEditingId(o.taskId);
                      setShowModal(true);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(o)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {occurrences.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">
                No tasks this day
              </li>
            )}
          </ul>
        </div>
      </div>
      {showModal && (
        <TaskModal
          date={date}
          taskId={editingId}
          occurrence={editingOccurrence ?? undefined}
          onClose={() => {
            setShowModal(false);
            setEditingId(null);
            setEditingOccurrence(null);
          }}
          onSaved={() => {
            onTaskChange();
            setShowModal(false);
            setEditingId(null);
            setEditingOccurrence(null);
          }}
        />
      )}
      {showDeleteModal && deletingOccurrence && (
        <DeleteConfirmationModal
          occurrence={deletingOccurrence}
          onConfirm={deletingOccurrence.rrule ? handleDeleteConfirm : handleDeleteNonRecurring}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeletingOccurrence(null);
          }}
          deleting={deleting}
        />
      )}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2 shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

function DeleteConfirmationModal({
  occurrence,
  onConfirm,
  onCancel,
  deleting,
}: {
  occurrence: TaskOccurrence;
  onConfirm: ((scope: 'single' | 'following') => void) | (() => void);
  onCancel: () => void;
  deleting: boolean;
}) {
  const isRecurring = !!occurrence.rrule;
  const [selectedScope, setSelectedScope] = useState<'single' | 'following'>('single');

  const handleConfirm = () => {
    if (isRecurring && typeof onConfirm === 'function' && onConfirm.length === 1) {
      (onConfirm as (scope: 'single' | 'following') => void)(selectedScope);
    } else {
      (onConfirm as () => void)();
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-hidden
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-200 px-6 py-5">
            <h3 className="text-lg font-semibold text-gray-800">Delete Task</h3>
          </div>
          <div className="px-6 py-5">
            {isRecurring ? (
              <>
                <p className="mb-4 text-sm text-gray-600">
                  This task is part of a recurring series. What would you like to delete?
                </p>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteScope"
                      value="single"
                      checked={selectedScope === 'single'}
                      onChange={() => setSelectedScope('single')}
                      className="mt-1 accent-blue-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">Only this task</div>
                      <div className="text-xs text-gray-500">Current occurrence only</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition hover:border-gray-300 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteScope"
                      value="following"
                      checked={selectedScope === 'following'}
                      onChange={() => setSelectedScope('following')}
                      className="mt-1 accent-blue-600"
                    />
                    <div>
                      <div className="font-medium text-gray-800">This and following</div>
                      <div className="text-xs text-gray-500">From this occurrence forward</div>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              <p className="mb-4 text-sm text-gray-600">
                Are you sure you want to delete this task?
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white bg-red-600 transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function toIso(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Local calendar day-of-month (1–31) from startAt; used for monthly-by-day default.
 * E.g. startAt 2026-02-12 (local) -> 12; startAt 2026-02-09 -> 9.
 */
function getLocalDayOfMonth(startAt: string | Date): number {
  const d = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const day = d.getDate();
  return Math.min(31, Math.max(1, day));
}

function TaskModal({
  date,
  taskId,
  occurrence,
  onClose,
  onSaved,
}: {
  date: Date;
  taskId: string | null;
  occurrence?: TaskOccurrence;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<{ id: string; fullName: string; address: string; phone: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customerManuallyEdited, setCustomerManuallyEdited] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [servicePriceCents, setServicePriceCents] = useState<number | null>(null);
  const [priceDisplay, setPriceDisplay] = useState<string>('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [assignedTeamId, setAssignedTeamId] = useState('');
  const [recurrence, setRecurrence] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>('once');
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [monthlyInterval, setMonthlyInterval] = useState(1);
  const [monthlyPattern, setMonthlyPattern] = useState<'day' | 'lastDay' | 'nthWeekday'>('day');
  const [monthlyDay, setMonthlyDay] = useState(1);
  const monthlyDaySyncedFromStartRef = useRef(false);
  const [monthlyNth, setMonthlyNth] = useState<1 | 2 | 3 | 4 | -1>(1);
  const [monthlyWeekday, setMonthlyWeekday] = useState(0);
  const [yearlyInterval, setYearlyInterval] = useState(1);
  const [yearlyPattern, setYearlyPattern] = useState<'date' | 'nthWeekday'>('date');
  const [yearlyMonth, setYearlyMonth] = useState(1);
  const [yearlyDay, setYearlyDay] = useState(15);
  const [yearlyNth, setYearlyNth] = useState<1 | 2 | 3 | 4 | -1>(1);
  const [yearlyWeekday, setYearlyWeekday] = useState(0);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; colorHex: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [editScope, setEditScope] = useState<'single' | 'following' | 'all'>('single');
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, t] = await Promise.all([
        import('@/lib/api').then((m) => m.services.list()),
        import('@/lib/api').then((m) => m.teams.list()),
      ]);
      setServices(s);
      setTeams(t);
    };
    load();
  }, []);

  // Debounced customer search
  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const results = await import('@/lib/api').then((m) => m.customers.list(customerQuery));
        setCustomerSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [customerQuery]);

  // Service selection no longer auto-fills price
  // Price must be manually entered for each task

  const isRecurringEdit = taskId && occurrence?.rrule && (recurrence === 'weekly' || recurrence === 'monthly' || recurrence === 'yearly');

  useEffect(() => {
    if (recurrence === 'monthly' && monthlyPattern === 'day' && monthlyDaySyncedFromStartRef.current && startAt) {
      setMonthlyDay(getLocalDayOfMonth(startAt));
    }
  }, [startAt, recurrence, monthlyPattern]);

  useEffect(() => {
    if (taskId) {
      tasks.get(taskId).then((task) => {
        const base = { customerName: task.customerName, customerId: task.customerId, address: task.address ?? '', phone: task.phone ?? '', serviceId: task.serviceId ?? '', servicePriceCents: task.servicePriceCents, description: task.description ?? '', notes: task.notes ?? '', startAt: task.startAt, endAt: task.endAt, allDay: task.allDay, assignedTeamId: task.assignedTeamId ?? '' };
        if (occurrence) {
          setCustomerName(occurrence.customerName);
          setCustomerId(occurrence.customerId);
          setCustomerQuery(occurrence.customerName);
          setAddress(occurrence.address ?? '');
          setPhone(occurrence.phone ?? '');
          setServiceId(occurrence.serviceId ?? '');
          setServicePriceCents(occurrence.servicePriceCents);
          setPriceDisplay(occurrence.servicePriceCents !== null ? (occurrence.servicePriceCents / 100).toFixed(2) : '');
          setDescription(occurrence.description ?? '');
          setNotes(occurrence.notes ?? '');
          setStartAt(occurrence.occurrenceStart);
          setEndAt(occurrence.occurrenceEnd);
          setAllDay(occurrence.allDay);
          setAssignedTeamId(occurrence.assignedTeamId ?? '');
        } else {
          setCustomerName(base.customerName);
          setCustomerId(base.customerId);
          setCustomerQuery(base.customerName);
          setAddress(base.address);
          setPhone(base.phone);
          setServiceId(base.serviceId);
          setServicePriceCents(base.servicePriceCents);
          setPriceDisplay(base.servicePriceCents !== null ? (base.servicePriceCents / 100).toFixed(2) : '');
          setDescription(base.description);
          setNotes(base.notes);
          setStartAt(base.startAt);
          setEndAt(base.endAt);
          setAllDay(base.allDay);
          setAssignedTeamId(base.assignedTeamId);
        }
        setCustomerManuallyEdited((occurrence?.customerId ?? base.customerId) === null);
        if (task.rrule) {
          const r = task.rrule;
          if (r.includes('FREQ=WEEKLY')) {
            setRecurrence('weekly');
            const m = r.match(/INTERVAL=(\d+)/);
            setWeeklyInterval(m ? parseInt(m[1], 10) : 1);
            const byday = r.match(/BYDAY=([A-Z,]+)/);
            if (byday) {
              const dayMap: Record<string, number> = {
                SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
              };
              setWeeklyDays(byday[1].split(',').map((d) => dayMap[d] ?? 0));
            }
          } else if (r.includes('FREQ=MONTHLY')) {
            setRecurrence('monthly');
            const m = r.match(/INTERVAL=(\d+)/);
            setMonthlyInterval(m ? parseInt(m[1], 10) : 1);
            const bymonthday = r.match(/BYMONTHDAY=(-?\d+)/);
            const byday = r.match(/BYDAY=([A-Z]+)/);
            const bysetpos = r.match(/BYSETPOS=(-?\d+)/);
            if (bymonthday) {
              const n = parseInt(bymonthday[1], 10);
              if (n === -1) {
                setMonthlyPattern('lastDay');
              } else {
                setMonthlyPattern('day');
                setMonthlyDay(Math.min(31, Math.max(1, n)));
                monthlyDaySyncedFromStartRef.current = false;
              }
            } else if (byday && bysetpos) {
              setMonthlyPattern('nthWeekday');
              const dayMap: Record<string, number> = {
                SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
              };
              setMonthlyWeekday(dayMap[byday[1]] ?? 0);
              const pos = parseInt(bysetpos[1], 10);
              setMonthlyNth((pos >= 1 && pos <= 4 ? pos : pos === -1 ? -1 : 1) as 1 | 2 | 3 | 4 | -1);
            }
          } else if (r.includes('FREQ=YEARLY')) {
            setRecurrence('yearly');
            const m = r.match(/INTERVAL=(\d+)/);
            setYearlyInterval(m ? parseInt(m[1], 10) : 1);
            const bymonth = r.match(/BYMONTH=(\d+)/);
            const bymonthday = r.match(/BYMONTHDAY=(\d+)/);
            const byday = r.match(/BYDAY=([A-Z]+)/);
            const bysetpos = r.match(/BYSETPOS=(-?\d+)/);
            if (bymonth) setYearlyMonth(parseInt(bymonth[1], 10));
            if (bymonthday) setYearlyDay(Math.min(31, Math.max(1, parseInt(bymonthday[1], 10))));
            if (byday && bysetpos) {
              setYearlyPattern('nthWeekday');
              const dayMap: Record<string, number> = {
                SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
              };
              setYearlyWeekday(dayMap[byday[1]] ?? 0);
              const pos = parseInt(bysetpos[1], 10);
              setYearlyNth((pos >= 1 && pos <= 4 ? pos : pos === -1 ? -1 : 1) as 1 | 2 | 3 | 4 | -1);
            } else {
              setYearlyPattern('date');
            }
          } else {
            setRecurrence('once');
          }
        } else {
          setRecurrence('once');
        }
      }).catch(() => {});
    } else {
      const dayStart = new Date(date);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(17, 0, 0, 0);
      setStartAt(toIso(dayStart));
      setEndAt(toIso(dayEnd));
      setPriceDisplay('');
      setServicePriceCents(null);
      setCustomerName('');
      setCustomerId(null);
      setCustomerQuery('');
      setAddress('');
      setPhone('');
      setCustomerManuallyEdited(false);
      setRecurrence('once');
      setMonthlyInterval(1);
      setMonthlyPattern('day');
      setMonthlyDay(getLocalDayOfMonth(dayStart));
      monthlyDaySyncedFromStartRef.current = false;
      setMonthlyNth(1);
      setMonthlyWeekday(0);
      setYearlyInterval(1);
      setYearlyPattern('date');
      setYearlyMonth(1);
      setYearlyDay(15);
      setYearlyNth(1);
      setYearlyWeekday(0);
    }
  }, [taskId, date, occurrence]);

  async function performUpdate(payload: Record<string, unknown>, scope?: 'single' | 'following' | 'all', occurrenceStart?: string) {
    if (!taskId) return;
    await tasks.update(taskId, payload, scope, occurrenceStart);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      const dayMap: Record<number, string> = {
        0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
      };
      let rrule: string | null | undefined;
      if (recurrence === 'weekly' && weeklyDays.length) {
        const byday = weeklyDays.map((d) => dayMap[d]).join(',');
        rrule = `FREQ=WEEKLY;INTERVAL=${weeklyInterval};BYDAY=${byday}`;
      } else if (recurrence === 'monthly') {
        if (monthlyPattern === 'day') {
          rrule = `FREQ=MONTHLY;INTERVAL=${monthlyInterval};BYMONTHDAY=${Math.min(31, Math.max(1, monthlyDay))}`;
        } else if (monthlyPattern === 'lastDay') {
          rrule = `FREQ=MONTHLY;INTERVAL=${monthlyInterval};BYMONTHDAY=-1`;
        } else {
          rrule = `FREQ=MONTHLY;INTERVAL=${monthlyInterval};BYDAY=${dayMap[monthlyWeekday]};BYSETPOS=${monthlyNth}`;
        }
      } else if (recurrence === 'yearly') {
        if (yearlyPattern === 'date') {
          rrule = `FREQ=YEARLY;INTERVAL=${yearlyInterval};BYMONTH=${yearlyMonth};BYMONTHDAY=${Math.min(31, Math.max(1, yearlyDay))}`;
        } else {
          rrule = `FREQ=YEARLY;INTERVAL=${yearlyInterval};BYMONTH=${yearlyMonth};BYDAY=${dayMap[yearlyWeekday]};BYSETPOS=${yearlyNth}`;
        }
      } else if (taskId) {
        rrule = null;
      }
      const payload = {
        customerName,
        customerId: customerId || undefined,
        phone: phone || undefined,
        serviceId: serviceId || undefined,
        servicePriceCents: servicePriceCents ?? undefined,
        address: address || undefined,
        description: description || undefined,
        notes: notes || undefined,
        startAt: toIso(start),
        endAt: toIso(end),
        allDay,
        assignedTeamId: assignedTeamId || undefined,
        ...(rrule !== undefined && { rrule }),
      };
      if (taskId) {
        if (isRecurringEdit) {
          setPendingPayload(payload);
          setShowEditScopeModal(true);
          setLoading(false);
          return;
        }
        await tasks.update(taskId, payload);
      } else {
        const createPayload = { ...payload, rrule: payload.rrule ?? undefined };
        console.log('[CREATE TASK] Sending payload:', createPayload);
        const result = await tasks.create(createPayload);
        console.log('[CREATE TASK] Response:', result);
      }
      onSaved();
    } catch (err) {
      console.error('[CREATE TASK ERROR]', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditScopeConfirm(scope: 'single' | 'following' | 'all') {
    if (!pendingPayload || !taskId || !occurrence) return;
    setLoading(true);
    setShowEditScopeModal(false);
    try {
      await performUpdate(pendingPayload, scope, occurrence.occurrenceStart);
      setPendingPayload(null);
      onSaved();
    } catch (err) {
      console.error('[EDIT TASK ERROR]', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  const WEEKDAY_OPTIONS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">
          {taskId ? 'Edit task' : 'Add task'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium">Customer name *</label>
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => {
                const val = e.target.value;
                setCustomerQuery(val);
                setCustomerName(val);
                // If user manually edits (not selecting from suggestions), clear customer link
                const hadCustomerId = customerId !== null;
                if (hadCustomerId) {
                  setCustomerId(null);
                  setAddress('');
                  setPhone('');
                }
                setCustomerManuallyEdited(true);
              }}
              onFocus={() => {
                if (customerQuery.length >= 2) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding suggestions to allow clicking
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
              placeholder="Start typing customer name..."
            />
            {showSuggestions && customerSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerName(c.fullName);
                      setCustomerQuery(c.fullName);
                      setCustomerId(c.id);
                      setAddress(c.address);
                      setPhone(c.phone);
                      setCustomerManuallyEdited(false);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    <div className="font-medium">{c.fullName}</div>
                    <div className="text-xs text-gray-500">{c.address}</div>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && customerQuery.length >= 2 && customerSuggestions.length === 0 && (
              <div className="absolute z-50 mt-1 w-full rounded border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 shadow-lg">
                No matches found
              </div>
            )}
            {customerId && (
              <div className="mt-1 text-xs text-blue-600">Linked to customer</div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={priceDisplay}
              onChange={(e) => {
                const val = e.target.value;
                setPriceDisplay(val);
                if (val === '' || val === '.') {
                  setServicePriceCents(null);
                } else {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0) {
                    // Convert dollars to cents (round to avoid floating point issues)
                    const cents = Math.round(num * 100);
                    setServicePriceCents(cents);
                  } else {
                    setServicePriceCents(null);
                  }
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val === '' || val === '.') {
                  setPriceDisplay('');
                  setServicePriceCents(null);
                } else {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0) {
                    // Format to 2 decimal places on blur and ensure cents are correct
                    const formatted = num.toFixed(2);
                    setPriceDisplay(formatted);
                    const cents = Math.round(num * 100);
                    setServicePriceCents(cents);
                  } else {
                    setPriceDisplay('');
                    setServicePriceCents(null);
                  }
                }
              }}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Enter price"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Start</label>
              <input
                type="datetime-local"
                value={startAt ? toLocalDatetime(startAt) : ''}
                onChange={(e) => setStartAt(toIso(new Date(e.target.value)))}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">End</label>
              <input
                type="datetime-local"
                value={endAt ? toLocalDatetime(endAt) : ''}
                onChange={(e) => setEndAt(toIso(new Date(e.target.value)))}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            <label htmlFor="allDay" className="text-sm">All day</label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Assigned Team</label>
            <select
              value={assignedTeamId}
              onChange={(e) => setAssignedTeamId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Recurrence</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1">
                <input type="radio" name="recurrence" checked={recurrence === 'once'} onChange={() => setRecurrence('once')} />
                None
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="recurrence" checked={recurrence === 'weekly'} onChange={() => setRecurrence('weekly')} />
                Weekly
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="recurrence"
                  checked={recurrence === 'monthly'}
                  onChange={() => {
                    setRecurrence('monthly');
                    setMonthlyDay(getLocalDayOfMonth(startAt));
                    monthlyDaySyncedFromStartRef.current = true;
                  }}
                />
                Monthly
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="recurrence" checked={recurrence === 'yearly'} onChange={() => setRecurrence('yearly')} />
                Yearly
              </label>
            </div>
            {recurrence === 'weekly' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm">Every</span>
                <input
                  type="number"
                  min={1}
                  value={weeklyInterval}
                  onChange={(e) => setWeeklyInterval(parseInt(e.target.value, 10) || 1)}
                  className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-sm">week(s) on</span>
                {WEEKDAY_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={weeklyDays.includes(value)}
                      onChange={(e) =>
                        setWeeklyDays((d) =>
                          e.target.checked ? [...d, value] : d.filter((x) => x !== value),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
            {recurrence === 'monthly' && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Every</span>
                  <input
                    type="number"
                    min={1}
                    value={monthlyInterval}
                    onChange={(e) => setMonthlyInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-sm">month(s)</span>
                </div>
                <div className="space-y-2 pl-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="monthlyPattern" checked={monthlyPattern === 'day'} onChange={() => setMonthlyPattern('day')} />
                    <span className="text-sm">On day</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthlyDay}
                      onChange={(e) => {
                        monthlyDaySyncedFromStartRef.current = false;
                        setMonthlyDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)));
                      }}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    {monthlyDay >= 30 && (
                      <span className="text-xs text-gray-500">Months without this day are skipped</span>
                    )}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="monthlyPattern" checked={monthlyPattern === 'lastDay'} onChange={() => setMonthlyPattern('lastDay')} />
                    <span className="text-sm">On the last day of the month</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="monthlyPattern" checked={monthlyPattern === 'nthWeekday'} onChange={() => setMonthlyPattern('nthWeekday')} />
                    <span className="text-sm">On the</span>
                    <select
                      value={monthlyNth}
                      onChange={(e) => setMonthlyNth(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | -1)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value={1}>1st</option>
                      <option value={2}>2nd</option>
                      <option value={3}>3rd</option>
                      <option value={4}>4th</option>
                      <option value={-1}>last</option>
                    </select>
                    <select
                      value={monthlyWeekday}
                      onChange={(e) => setMonthlyWeekday(parseInt(e.target.value, 10))}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {WEEKDAY_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
            {recurrence === 'yearly' && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Every</span>
                  <input
                    type="number"
                    min={1}
                    value={yearlyInterval}
                    onChange={(e) => setYearlyInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-sm">year(s)</span>
                </div>
                <div className="space-y-2 pl-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="yearlyPattern" checked={yearlyPattern === 'date'} onChange={() => setYearlyPattern('date')} />
                    <span className="text-sm">On</span>
                    <select
                      value={yearlyMonth}
                      onChange={(e) => setYearlyMonth(parseInt(e.target.value, 10))}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={yearlyDay}
                      onChange={(e) => setYearlyDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="yearlyPattern" checked={yearlyPattern === 'nthWeekday'} onChange={() => setYearlyPattern('nthWeekday')} />
                    <span className="text-sm">On the</span>
                    <select
                      value={yearlyNth}
                      onChange={(e) => setYearlyNth(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | -1)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value={1}>1st</option>
                      <option value={2}>2nd</option>
                      <option value={3}>3rd</option>
                      <option value={4}>4th</option>
                      <option value={-1}>last</option>
                    </select>
                    <select
                      value={yearlyWeekday}
                      onChange={(e) => setYearlyWeekday(parseInt(e.target.value, 10))}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {WEEKDAY_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <span className="text-sm">of</span>
                    <select
                      value={yearlyMonth}
                      onChange={(e) => setYearlyMonth(parseInt(e.target.value, 10))}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
      {showEditScopeModal && occurrence && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setShowEditScopeModal(false)} aria-hidden />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-800">Edit Recurring Task</h3>
              </div>
              <div className="px-6 py-4">
                <p className="mb-4 text-sm text-gray-600">
                  This task is part of a recurring series. What would you like to edit?
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="editScope" value="single" checked={editScope === 'single'} onChange={() => setEditScope('single')} className="mt-1" />
                    <div>
                      <div className="font-medium text-gray-800">Only this task</div>
                      <div className="text-xs text-gray-500">Current occurrence only</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="editScope" value="following" checked={editScope === 'following'} onChange={() => setEditScope('following')} className="mt-1" />
                    <div>
                      <div className="font-medium text-gray-800">This and following</div>
                      <div className="text-xs text-gray-500">This occurrence and all future ones</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
                    <input type="radio" name="editScope" value="all" checked={editScope === 'all'} onChange={() => setEditScope('all')} className="mt-1" />
                    <div>
                      <div className="font-medium text-gray-800">All tasks in series</div>
                      <div className="text-xs text-gray-500">Every occurrence</div>
                    </div>
                  </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowEditScopeModal(false); setPendingPayload(null); }} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={() => handleEditScopeConfirm(editScope)} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

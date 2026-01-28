'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const rangeStart = startOfMonth(viewDate);
  const rangeEnd = endOfMonth(viewDate);
  const rangeStartUtc = rangeStart;
  const rangeEndUtc = rangeEnd;

  const loadTasks = useCallback(() => {
    setLoading(true);
    tasks
      .list(rangeStartUtc.toISOString(), rangeEndUtc.toISOString())
      .then(setOccurrences)
      .catch(() => setOccurrences([]))
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

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewDate((d) => subMonths(d, 1))}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Prev
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Next
          </button>
          <h2 className="ml-2 text-xl font-semibold text-gray-800">
            {format(viewDate, 'MMMM yyyy')}
          </h2>
        </div>
        <Link
          href="/settings"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Settings
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="border-r border-gray-200 py-2 text-center text-xs font-medium text-gray-600 last:border-r-0"
            >
              {wd}
            </div>
          ))}
        </div>
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center text-gray-500">
            Loading…
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{ minHeight: 100 }}
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
                    className={`day-cell cursor-pointer border-r border-b border-gray-200 last:border-r-0 ${isToday(day) ? 'today' : ''} ${!isCurrentMonth ? 'bg-gray-50' : ''}`}
                  >
                    <div
                      className={`mb-1 text-right text-sm ${!isCurrentMonth ? 'text-gray-400' : isToday(day) ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
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

  return (
    <>
      <div
        className="fixed inset-0 z-20 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed right-0 top-0 z-30 h-full w-full max-w-md border-l border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="font-semibold text-gray-800">
            {format(date, 'EEEE, MMM d, yyyy')}
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          <button
            onClick={() => {
              setEditingId(null);
              setShowModal(true);
            }}
            className="mb-4 w-full rounded-lg border border-blue-600 bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add task
          </button>
          <ul className="space-y-2">
            {occurrences.map((o) => (
              <li
                key={`${o.taskId}-${o.occurrenceStart}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800 truncate">
                    {o.customerName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {o.service?.name ?? 'No service'} · {o.servicePriceCents !== null ? `$${(o.servicePriceCents / 100).toFixed(2)}` : '—'} · {o.createdBy.username}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingId(o.taskId);
                    setShowModal(true);
                  }}
                  className="ml-2 rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Edit
                </button>
              </li>
            ))}
            {occurrences.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-500">
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
          onClose={() => {
            setShowModal(false);
            setEditingId(null);
          }}
          onSaved={() => {
            onTaskChange();
            setShowModal(false);
            setEditingId(null);
          }}
        />
      )}
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

function TaskModal({
  date,
  taskId,
  onClose,
  onSaved,
}: {
  date: Date;
  taskId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [servicePriceCents, setServicePriceCents] = useState<number | null>(null);
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [assignedTeamId, setAssignedTeamId] = useState('');
  const [recurrence, setRecurrence] = useState<'once' | 'weekly'>('once');
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; priceCents: number }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; colorHex: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (serviceId && !priceOverridden) {
      const svc = services.find((s) => s.id === serviceId);
      if (svc) {
        setServicePriceCents(svc.priceCents);
      }
    }
    // If service cleared, keep price as-is (don't clear it)
  }, [serviceId, services, priceOverridden]);

  useEffect(() => {
    if (taskId) {
      tasks.get(taskId).then((task) => {
        setCustomerName(task.customerName);
        setServiceId(task.serviceId ?? '');
        setServicePriceCents(task.servicePriceCents);
        setPriceOverridden(task.servicePriceCents !== null);
        setAddress(task.address ?? '');
        setDescription(task.description ?? '');
        setNotes(task.notes ?? '');
        setStartAt(task.startAt);
        setEndAt(task.endAt);
        setAllDay(task.allDay);
        setAssignedTeamId(task.assignedTeamId ?? '');
        if (task.rrule) {
          setRecurrence('weekly');
          const m = task.rrule.match(/INTERVAL=(\d+)/);
          setWeeklyInterval(m ? parseInt(m[1], 10) : 1);
          const byday = task.rrule.match(/BYDAY=([A-Z,]+)/);
          if (byday) {
            const dayMap: Record<string, number> = {
              SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
            };
            setWeeklyDays(byday[1].split(',').map((d) => dayMap[d] ?? 0));
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
    }
  }, [taskId, date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      let rrule: string | null | undefined;
      if (recurrence === 'weekly' && weeklyDays.length) {
        const dayMap: Record<number, string> = {
          0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
        };
        const byday = weeklyDays.map((d) => dayMap[d]).join(',');
        rrule = `FREQ=WEEKLY;INTERVAL=${weeklyInterval};BYDAY=${byday}`;
      } else if (taskId) {
        rrule = null;
      }
      const payload = {
        customerName,
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
        await tasks.update(taskId, payload);
      } else {
        await tasks.create(payload);
      }
      onSaved();
    } catch (err) {
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
          <div>
            <label className="mb-1 block text-sm font-medium">Customer name *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Service</label>
            <select
              value={serviceId}
              onChange={(e) => {
                const newServiceId = e.target.value;
                setServiceId(newServiceId);
                if (newServiceId) {
                  setPriceOverridden(false);
                }
              }}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (${(s.priceCents / 100).toFixed(2)})
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
              value={servicePriceCents !== null ? (servicePriceCents / 100).toFixed(2) : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setServicePriceCents(null);
                } else {
                  const cents = Math.round(parseFloat(val) * 100);
                  if (!isNaN(cents) && cents >= 0) {
                    setServicePriceCents(cents);
                    setPriceOverridden(true);
                  }
                }
              }}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Auto-filled from service"
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
            <div className="flex gap-4">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="recurrence"
                  checked={recurrence === 'once'}
                  onChange={() => setRecurrence('once')}
                />
                One-time
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="recurrence"
                  checked={recurrence === 'weekly'}
                  onChange={() => setRecurrence('weekly')}
                />
                Weekly
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
    </>
  );
}

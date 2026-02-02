'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { tasks, teams, sortTeamsNaturally, type TaskOccurrence, type Team } from '@/lib/api';
import { getEventDisplayLines } from '@/lib/calendar-settings';
import type { CalendarSettings } from '@/lib/calendar-settings';

const HOUR_START = 6;
const HOUR_END = 22;
const PX_PER_MINUTE = 1.2;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;
const GRID_HEIGHT_PX = TOTAL_MINUTES * PX_PER_MINUTE;

function startOfDayLocal(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDayLocal(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function durationMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (60 * 1000);
}

export type CreatePrefill = {
  date: Date;
  startAt: string;
  endAt: string;
  assignedTeamId: string | null;
};

export default function DayView({
  viewDate,
  calendarSettings,
  refreshKey = 0,
  onPrev,
  onNext,
  onTaskClick,
  onEmptySlotClick,
}: {
  viewDate: Date;
  calendarSettings: CalendarSettings;
  refreshKey?: number;
  onPrev: () => void;
  onNext: () => void;
  onTaskClick: (occurrence: TaskOccurrence) => void;
  onEmptySlotClick: (prefill: CreatePrefill) => void;
}) {
  const [occurrences, setOccurrences] = useState<TaskOccurrence[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const dayStart = useMemo(() => startOfDayLocal(viewDate), [viewDate]);
  const dayEnd = useMemo(() => endOfDayLocal(viewDate), [viewDate]);
  const fromIso = dayStart.toISOString();
  const toIso = dayEnd.toISOString();

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([tasks.list(fromIso, toIso), teams.list()])
      .then(([occ, t]) => {
        setOccurrences(occ);
        setTeamsList(t);
      })
      .catch((err) => {
        console.error('[DayView]', err);
        setOccurrences([]);
        setTeamsList([]);
      })
      .finally(() => setLoading(false));
  }, [fromIso, toIso]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (!isToday(viewDate)) return;
    const id = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, [viewDate]);

  const columns = useMemo(() => {
    const sorted = sortTeamsNaturally(teamsList);
    const cols: { id: string | null; name: string }[] = sorted.map((t) => ({ id: t.id, name: t.name }));
    cols.push({ id: null, name: 'Unassigned' });
    return cols;
  }, [teamsList]);

  const occurrencesForDay = useMemo(() => {
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();
    return occurrences.filter((o) => {
      const start = parseISO(o.occurrenceStart);
      return start.getTime() >= dayStartMs && start.getTime() <= dayEndMs;
    });
  }, [occurrences, dayStart, dayEnd]);

  const gridStartMinutes = HOUR_START * 60;

  const handleSlotClick = useCallback(
    (hour: number, minute: number, teamId: string | null) => {
      // Build local wall-time date (avoids UTC/date-string parsing issues)
      const start = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        viewDate.getDate(),
        hour,
        minute,
        0,
        0,
      );
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      onEmptySlotClick({
        date: viewDate,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        assignedTeamId: teamId,
      });
    },
    [viewDate, onEmptySlotClick],
  );

  const showCurrentTimeLine = isToday(viewDate);
  const currentMinutes = minutesFromMidnight(currentTime);
  const currentLineTop =
    currentMinutes >= HOUR_START * 60 && currentMinutes <= HOUR_END * 60
      ? (currentMinutes - gridStartMinutes) * PX_PER_MINUTE
      : null;

  const hours: number[] = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
    hours.push(h);
  }

  return (
    <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      )}
      <div
        className="grid min-w-[600px]"
        style={{
          gridTemplateColumns: `80px repeat(${columns.length}, minmax(120px, 1fr))`,
        }}
      >
        <div className="border-b border-r border-gray-200 bg-gray-50/80" />
        {columns.map((col) => (
          <div
            key={col.id ?? 'unassigned'}
            className="border-b border-r border-gray-200 bg-gray-50/80 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 last:border-r-0"
          >
            {col.name}
          </div>
        ))}

        {hours.map((hour) => (
          <React.Fragment key={hour}>
            <div
              className="border-r border-gray-100 pr-1 text-right text-xs text-gray-500"
              style={{ height: 60 * PX_PER_MINUTE }}
            >
              {format(new Date(2000, 0, 1, hour, 0), 'h a')}
            </div>
            {columns.map((col) => (
              <div
                key={`${hour}-${col.id ?? 'u'}`}
                className="relative border-b border-r border-gray-100 last:border-r-0"
                style={{ height: 60 * PX_PER_MINUTE }}
              >
                <div
                  className="absolute inset-0 cursor-pointer hover:bg-blue-50/30"
                  onClick={() => handleSlotClick(hour, 0, col.id)}
                />
                <div
                  className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100"
                  style={{ height: 0 }}
                />
                <div
                  className="absolute inset-0 top-1/2 cursor-pointer hover:bg-blue-50/30"
                  onClick={() => handleSlotClick(hour, 30, col.id)}
                />
              </div>
            ))}
          </React.Fragment>
        ))}

        <div style={{ height: 0, gridColumn: '1 / -1' }} />
      </div>

      <div
        className="pointer-events-none absolute left-0 top-[41px] right-0 z-10 min-w-[600px]"
        style={{
          height: GRID_HEIGHT_PX,
          display: 'grid',
          gridTemplateColumns: `80px repeat(${columns.length}, minmax(120px, 1fr))`,
        }}
      >
        <div className="col-span-1" />
        {columns.map((col) => (
          <div
            key={`ev-${col.id ?? 'u'}`}
            className="pointer-events-auto relative col-span-1"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-event-block]')) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const yOffset = e.clientY - rect.top;
              const minutesFromStart = gridStartMinutes + yOffset / PX_PER_MINUTE;
              const rounded = Math.round(minutesFromStart / 30) * 30;
              const hour = HOUR_START + Math.floor(rounded / 60);
              const minute = rounded % 60;
              handleSlotClick(hour, minute, col.id);
            }}
          >
            {occurrencesForDay
              .filter((o) => (o.assignedTeamId ?? null) === col.id)
              .map((o) => {
                const start = parseISO(o.occurrenceStart);
                const end = parseISO(o.occurrenceEnd);
                const top = (minutesFromMidnight(start) - gridStartMinutes) * PX_PER_MINUTE;
                const h = Math.max(20, durationMinutes(start, end) * PX_PER_MINUTE);
                const color = o.assignedTeam?.colorHex ?? '#6b7280';
                const lines = getEventDisplayLines(o, calendarSettings);

                return (
                  <div
                    key={`${o.taskId}-${o.occurrenceStart}`}
                    className="absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded px-1.5 py-0.5 text-white shadow-sm transition hover:opacity-90"
                    style={{
                      top,
                      height: h,
                      minHeight: 20,
                      backgroundColor: color,
                    }}
                    data-event-block
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(o);
                    }}
                  >
                    {lines.map((line, i) => (
                      <div key={i} className="truncate text-[10px] leading-tight">
                        {line}
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        ))}

        {showCurrentTimeLine && currentLineTop != null && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 h-0.5 bg-red-500"
            style={{ top: currentLineTop }}
          >
            <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}

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
const DAY_VIEW_SCROLL_HEIGHT = 'calc(100vh - 200px)';

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

  const HOURS_COL_WIDTH = 60;
  const teamsAreaWidth = columns.length * 120;
  const gridMinWidth = HOURS_COL_WIDTH + teamsAreaWidth;
  const contentHeight = 41 + GRID_HEIGHT_PX;

  return (
    <div
      className="relative rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ height: DAY_VIEW_SCROLL_HEIGHT }}
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 rounded-xl">
          <span className="text-sm text-gray-500">Loading…</span>
        </div>
      )}
      <div
        className="h-full overflow-x-scroll overflow-y-scroll"
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        <div
          className="flex"
          style={{
            minWidth: gridMinWidth,
            width: 'max-content',
            height: contentHeight,
          }}
        >
          {/* Sticky hours column */}
          <div
            className="sticky left-0 z-30 flex shrink-0 flex-col border-r border-gray-200 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
            style={{ width: HOURS_COL_WIDTH }}
          >
            <div className="h-[41px] border-b border-gray-200 bg-gray-50/80" />
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-100 pr-1 text-right text-xs text-gray-500"
                style={{ height: 60 * PX_PER_MINUTE, lineHeight: `${60 * PX_PER_MINUTE}px` }}
              >
                {format(new Date(2000, 0, 1, hour, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Teams area (scrolls horizontally) */}
          <div
            className="relative flex shrink-0 flex-col"
            style={{ minWidth: teamsAreaWidth }}
          >
            {/* Team headers */}
            <div
              className="grid shrink-0 border-b border-gray-200 bg-gray-50/80"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`,
                width: teamsAreaWidth,
              }}
            >
              {columns.map((col) => (
                <div
                  key={col.id ?? 'unassigned'}
                  className="border-r border-gray-200 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 last:border-r-0"
                >
                  {col.name}
                </div>
              ))}
            </div>

            {/* Hour rows (slots) */}
            <div
              className="grid shrink-0"
              style={{
                gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`,
                width: teamsAreaWidth,
                height: GRID_HEIGHT_PX,
              }}
            >
              {hours.map((hour) =>
                columns.map((col) => (
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
                )),
              )}
            </div>

            {/* Events overlay */}
            <div
              className="pointer-events-none absolute left-0 top-[41px] z-10"
              style={{
                height: GRID_HEIGHT_PX,
                width: teamsAreaWidth,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`,
              }}
            >
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
                    const hr = HOUR_START + Math.floor(rounded / 60);
                    const mn = rounded % 60;
                    handleSlotClick(hr, mn, col.id);
                  }}
                >
                  {occurrencesForDay
                    .filter((o) => (o.assignedTeamId ?? null) === col.id)
                    .map((o) => {
                      const start = parseISO(o.occurrenceStart);
                      const end = parseISO(o.occurrenceEnd);
                      const top = (minutesFromMidnight(start) - gridStartMinutes) * PX_PER_MINUTE;
                      const blockH = Math.max(20, durationMinutes(start, end) * PX_PER_MINUTE);
                      const color = o.assignedTeam?.colorHex ?? '#6b7280';
                      const lines = getEventDisplayLines(o, calendarSettings);

                      return (
                        <div
                          key={`${o.taskId}-${o.occurrenceStart}`}
                          className="absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded px-1.5 py-0.5 text-white shadow-sm transition hover:opacity-90"
                          style={{
                            top,
                            height: blockH,
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
            </div>

            {/* Red current-time line (inside teams area, spans full width) */}
            {showCurrentTimeLine && currentLineTop != null && (
              <div
                className="pointer-events-none absolute left-0 z-20 h-0.5 bg-red-500"
                style={{
                  top: 41 + currentLineTop,
                  width: teamsAreaWidth,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

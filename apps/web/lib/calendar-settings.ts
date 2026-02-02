import { format, parseISO } from 'date-fns';
import type { TaskOccurrence } from './api';

export type CalendarSettings = {
  showTime: boolean;
  showPrice: boolean;
  showService: boolean;
  showDescription: boolean;
  showNotes: boolean;
};

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  showTime: true,
  showPrice: false,
  showService: false,
  showDescription: false,
  showNotes: false,
};

const MAX_EVENT_LINES = 6;

export function getEventDisplayLines(o: TaskOccurrence, s: CalendarSettings): string[] {
  const start = parseISO(o.occurrenceStart);
  const end = parseISO(o.occurrenceEnd);
  const lines: string[] = [];
  lines.push(o.customerName || '—');
  if (s.showTime) {
    const startStr = format(start, 'h:mm a');
    lines.push(end.getTime() > start.getTime() ? `${startStr} – ${format(end, 'h:mm a')}` : startStr);
  }
  if (s.showPrice && o.servicePriceCents != null) {
    lines.push(`$${(o.servicePriceCents / 100).toFixed(2)}`);
  }
  if (s.showService && o.service?.name) {
    lines.push(o.service.name);
  }
  if (s.showDescription && o.description?.trim()) {
    lines.push(o.description.trim());
  }
  if (s.showNotes && o.notes?.trim()) {
    lines.push(o.notes.trim());
  }
  return lines.slice(0, MAX_EVENT_LINES);
}

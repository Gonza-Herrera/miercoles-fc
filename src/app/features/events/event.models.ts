import { BadgeVariant } from '../../shared/ui';
import { Database } from '../../core/supabase/database.types';

export type EventStatus = Database['public']['Enums']['event_status'];
export type EventRow = Database['public']['Tables']['events']['Row'];

export interface WeeklyEvent {
  readonly courtPriceMinor: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly currencyCode: string;
  readonly groupId: string;
  readonly id: string;
  readonly location: string;
  readonly startsAt: string;
  readonly status: EventStatus;
  readonly title: string | null;
  readonly updatedAt: string;
}

export interface EventInput {
  readonly courtPrice: string;
  readonly date: string;
  readonly location: string;
  readonly time: string;
}

export type EventOperation =
  | 'CLOSED'
  | 'CREATE'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'PERMISSION'
  | 'SCHEDULE_LOCKED'
  | 'TRANSITION'
  | 'UPDATE'
  | 'VALIDATION';

export class EventOperationError extends Error {
  constructor(readonly operation: EventOperation) {
    super(operation);
    this.name = 'EventOperationError';
  }
}

export const EVENT_STATUS_LABELS: Readonly<Record<EventStatus, string>> = {
  DRAFT: 'Borrador',
  OPEN: 'Abierto',
  IN_PROGRESS: 'En curso',
  SETTLEMENT: 'Liquidación',
  CLOSED: 'Cerrado',
};

export const EVENT_STATUS_VARIANTS: Readonly<Record<EventStatus, BadgeVariant>> = {
  DRAFT: 'neutral',
  OPEN: 'primary',
  IN_PROGRESS: 'success',
  SETTLEMENT: 'warning',
  CLOSED: 'neutral',
};

export const EVENT_NEXT_STATUS: Readonly<Partial<Record<EventStatus, EventStatus>>> = {
  DRAFT: 'OPEN',
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'SETTLEMENT',
  SETTLEMENT: 'CLOSED',
};

export const EVENT_TRANSITION_LABELS: Readonly<Partial<Record<EventStatus, string>>> = {
  DRAFT: 'Abrir miércoles',
  OPEN: 'Iniciar miércoles',
  IN_PROGRESS: 'Pasar a liquidación',
  SETTLEMENT: 'Cerrar miércoles',
};

export function mapEvent(row: EventRow): WeeklyEvent {
  return {
    courtPriceMinor: row.court_price_minor,
    createdAt: row.created_at,
    createdBy: row.created_by,
    currencyCode: row.currency_code,
    groupId: row.group_id,
    id: row.id,
    location: row.location,
    startsAt: row.starts_at,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function eventTitle(event: WeeklyEvent): string {
  if (event.title) return event.title;
  const value = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date(event.startsAt));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function eventTime(startsAt: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

export function formatMoneyMinor(amountMinor: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    currency,
    currencyDisplay: 'symbol',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}

export function parseCourtPriceToMinor(value: string): number | null {
  const compact = value.trim().replace(/\s/g, '');
  let integer: string;
  let fraction: string;

  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(compact)) {
    const [whole, decimals = ''] = compact.split(',');
    integer = whole.replace(/\./g, '');
    fraction = decimals;
  } else if (/^\d+(,\d{1,2})?$/.test(compact)) {
    [integer, fraction = ''] = compact.split(',');
  } else if (/^\d+(\.\d{1,2})?$/.test(compact)) {
    [integer, fraction = ''] = compact.split('.');
  } else {
    return null;
  }

  const minor = BigInt(integer) * 100n + BigInt((fraction + '00').slice(0, 2));
  return minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

export function localDateTimeToIso(date: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) return null;
  const result = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  if (
    result.getFullYear() !== Number(match[1]) ||
    result.getMonth() !== Number(match[2]) - 1 ||
    result.getDate() !== Number(match[3]) ||
    result.getHours() !== Number(timeMatch[1]) ||
    result.getMinutes() !== Number(timeMatch[2])
  ) {
    return null;
  }
  return result.toISOString();
}

export function isoToLocalDateTime(iso: string): Pick<EventInput, 'date' | 'time'> {
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`,
    time: `${two(date.getHours())}:${two(date.getMinutes())}`,
  };
}

export function selectCurrentEvent(
  events: readonly WeeklyEvent[],
  now = new Date(),
): WeeklyEvent | null {
  const active = events
    .filter((event) => event.status === 'IN_PROGRESS' || event.status === 'SETTLEMENT')
    .sort((a, b) => {
      const priority = (status: EventStatus) => (status === 'IN_PROGRESS' ? 0 : 1);
      return (
        priority(a.status) - priority(b.status) || Date.parse(b.startsAt) - Date.parse(a.startsAt)
      );
    });
  if (active.length) return active[0];

  const open = events.filter((event) => event.status !== 'CLOSED');
  const upcoming = open
    .filter((event) => Date.parse(event.startsAt) >= now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  if (upcoming.length) return upcoming[0];

  return open.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;
}

export function canEditEvent(event: WeeklyEvent): boolean {
  return event.status !== 'CLOSED';
}

export function canEditSchedule(event: WeeklyEvent): boolean {
  return event.status === 'DRAFT' || event.status === 'OPEN';
}

export function parseSiteVisitTime(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    return {
      hour,
      minute,
      period: match[3].toUpperCase(),
    };
  }

  match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return null;
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

export function formatSiteVisitTime(value, fallbackDate) {
  const parsed = parseSiteVisitTime(value);
  if (parsed) {
    return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')} ${parsed.period}`;
  }

  if (fallbackDate) {
    const date = new Date(fallbackDate);
    if (Number.isFinite(date.getTime())) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }
  return '';
}

export function createLocalDateTime(dateValue, timeValue) {
  const match = typeof dateValue === 'string' && dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedTime = parseSiteVisitTime(timeValue);
  if (!match || !parsedTime) return null;

  const [, year, month, day] = match.map(Number);
  let hour = parsedTime.hour % 12;
  if (parsedTime.period === 'PM') hour += 12;
  const date = new Date(year, month - 1, day, hour, parsedTime.minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function localDateInput(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function siteVisitDateTimeParts(value) {
  if (!value) return { date: '', time: '' };
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return { date: '', time: '' };
  return {
    date: localDateInput(parsed),
    time: formatSiteVisitTime(
      `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
    ),
  };
}

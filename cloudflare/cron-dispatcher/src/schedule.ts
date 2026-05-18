import cronJobs from "../../../config/cron-jobs.json";

export interface CronJobDefinition {
  name: string;
  cron: string;
  path: string;
}

export const CRON_JOBS: CronJobDefinition[] = cronJobs;

function normalizeWeekdayValue(value: number) {
  return value === 7 ? 0 : value;
}

function parseSegmentBounds(
  segment: string,
  min: number,
  max: number,
  normalizeValue?: (value: number) => number
) {
  if (segment === "*") {
    return { start: min, end: max };
  }

  if (segment.includes("-")) {
    const [rawStart, rawEnd] = segment.split("-", 2);
    const start = Number.parseInt(rawStart, 10);
    const end = Number.parseInt(rawEnd, 10);
    return {
      start: normalizeValue ? normalizeValue(start) : start,
      end: normalizeValue ? normalizeValue(end) : end,
    };
  }

  const value = Number.parseInt(segment, 10);
  const normalized = normalizeValue ? normalizeValue(value) : value;
  return { start: normalized, end: normalized };
}

function matchesPart(
  part: string,
  value: number,
  min: number,
  max: number,
  normalizeValue?: (value: number) => number
) {
  const [segment, rawStep] = part.split("/", 2);
  const step = rawStep ? Number.parseInt(rawStep, 10) : 1;
  const { start, end } = parseSegmentBounds(
    segment,
    min,
    max,
    normalizeValue
  );

  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(step)) {
    return false;
  }

  if (step <= 0) {
    return false;
  }

  if (start <= end) {
    if (value < start || value > end) {
      return false;
    }
    return (value - start) % step === 0;
  }

  // Support wrapped ranges like 5-1 for weekday expressions if ever added later.
  if (value >= start) {
    return (value - start) % step === 0;
  }

  if (value <= end) {
    return max >= start && (value + (max + 1 - start)) % step === 0;
  }

  return false;
}

function matchesField(
  field: string,
  value: number,
  min: number,
  max: number,
  normalizeValue?: (value: number) => number
) {
  return field
    .split(",")
    .some((part) => matchesPart(part.trim(), value, min, max, normalizeValue));
}

export function matchesCronExpression(cron: string, date: Date) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Unsupported cron expression: ${cron}`);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return (
    matchesField(minute, date.getUTCMinutes(), 0, 59) &&
    matchesField(hour, date.getUTCHours(), 0, 23) &&
    matchesField(dayOfMonth, date.getUTCDate(), 1, 31) &&
    matchesField(month, date.getUTCMonth() + 1, 1, 12) &&
    matchesField(
      dayOfWeek,
      date.getUTCDay(),
      0,
      7,
      normalizeWeekdayValue
    )
  );
}

export function dueJobsForTime(date: Date) {
  return CRON_JOBS.filter((job) => matchesCronExpression(job.cron, date));
}

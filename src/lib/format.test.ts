/**
 * Tests for format.ts utilities
 *
 * Covers:
 * - formatRelativeTime: sub-day granularity (seconds, minutes, hours, days)
 * - formatRelativeTime: null/undefined => em-dash
 * - formatRelativeTime: >= 7d falls back to formatRelativeDate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime } from "./format";

// Fixed "now" for deterministic time calculations
// 2026-03-12T12:00:00Z
const NOW = new Date("2026-03-12T12:00:00.000Z").getTime();

function datesecAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function dateMinAgo(minutes: number): string {
  return new Date(NOW - minutes * 60 * 1000).toISOString();
}

function dateHoursAgo(hours: number): string {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

function dateDaysAgo(days: number): string {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("null/undefined handling", () => {
    it("null => em-dash character", () => {
      expect(formatRelativeTime(null)).toBe("—");
    });

    it("undefined => em-dash character", () => {
      expect(formatRelativeTime(undefined)).toBe("—");
    });
  });

  describe("sub-minute (< 60 seconds)", () => {
    it("30 seconds ago => 'just now'", () => {
      expect(formatRelativeTime(datesecAgo(30))).toBe("just now");
    });

    it("0 seconds (exact now) => 'just now'", () => {
      expect(formatRelativeTime(datesecAgo(0))).toBe("just now");
    });

    it("59 seconds ago => 'just now'", () => {
      expect(formatRelativeTime(datesecAgo(59))).toBe("just now");
    });
  });

  describe("minutes (>= 60s, < 60m)", () => {
    it("5 minutes ago => '5m ago'", () => {
      expect(formatRelativeTime(dateMinAgo(5))).toBe("5m ago");
    });

    it("1 minute ago => '1m ago'", () => {
      expect(formatRelativeTime(dateMinAgo(1))).toBe("1m ago");
    });

    it("59 minutes ago => '59m ago'", () => {
      expect(formatRelativeTime(dateMinAgo(59))).toBe("59m ago");
    });
  });

  describe("hours (>= 60m, < 24h)", () => {
    it("3 hours ago => '3h ago'", () => {
      expect(formatRelativeTime(dateHoursAgo(3))).toBe("3h ago");
    });

    it("1 hour ago => '1h ago'", () => {
      expect(formatRelativeTime(dateHoursAgo(1))).toBe("1h ago");
    });

    it("23 hours ago => '23h ago'", () => {
      expect(formatRelativeTime(dateHoursAgo(23))).toBe("23h ago");
    });
  });

  describe("days (>= 24h, < 7d)", () => {
    it("2 days ago => '2d ago'", () => {
      expect(formatRelativeTime(dateDaysAgo(2))).toBe("2d ago");
    });

    it("1 day ago => '1d ago'", () => {
      expect(formatRelativeTime(dateDaysAgo(1))).toBe("1d ago");
    });

    it("6 days ago => '6d ago'", () => {
      expect(formatRelativeTime(dateDaysAgo(6))).toBe("6d ago");
    });
  });

  describe("fallback to formatRelativeDate (>= 7 days)", () => {
    it("10 days ago => falls back to formatRelativeDate (returns week-based string)", () => {
      const result = formatRelativeTime(dateDaysAgo(10));
      // formatRelativeDate returns "Xw ago" for < 30 days
      expect(result).toMatch(/\d+w ago/);
    });

    it("30 days ago => falls back to formatRelativeDate (returns month-based string)", () => {
      const result = formatRelativeTime(dateDaysAgo(30));
      // formatRelativeDate returns "1mo ago" for ~30 days
      expect(result).toMatch(/\d+mo ago/);
    });
  });
});

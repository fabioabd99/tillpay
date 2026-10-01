import { format } from "date-fns";

// DATE values as "yyyy-MM-dd" in local time (toISOString() is UTC and can be a
// day off).
export const isoDate = (date: Date) => format(date, "yyyy-MM-dd");

// noon, so timezone offsets can't move the date
export const parseDate = (value: string) => new Date(`${value}T12:00:00`);

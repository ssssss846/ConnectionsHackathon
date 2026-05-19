export const APP_NAME = "UNSW Mates";
export const MAX_SUBJECTS_PER_TERM = 4;
export const TERMS = ["T1", "T2", "T3"] as const;
export const WEEK_DAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
] as const;
export const INTEREST_OPTIONS = [
  "sports",
  "mahjong",
  "chess",
  "animals",
  "music",
  "art",
  "food",
  "gaming",
  "career",
  "culture",
  "volunteering",
  "dance",
] as const;

export type Term = (typeof TERMS)[number];
export type Interest = (typeof INTEREST_OPTIONS)[number];

export const TERM_LABELS: Record<Term, string> = {
  T1: "Term 1",
  T2: "Term 2",
  T3: "Term 3",
};

export function getTermForDate(date = new Date()): Term {
  const month = date.getMonth();

  if (month >= 0 && month <= 3) {
    return "T1";
  }

  if (month >= 4 && month <= 7) {
    return "T2";
  }

  return "T3";
}

export function getCurrentTerm(date = new Date()): Term {
  return getTermForDate(date);
}

export function normalizeSubjectCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeZid(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function orderFriendPair(firstId: string, secondId: string) {
  return [firstId, secondId].sort() as [string, string];
}

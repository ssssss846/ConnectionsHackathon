export const APP_NAME = "UNSW Mates";
export const MAX_SUBJECTS_PER_TERM = 4;
export const TERMS = ["T1", "T2", "T3"] as const;

export type Term = (typeof TERMS)[number];

export const TERM_LABELS: Record<Term, string> = {
  T1: "Term 1",
  T2: "Term 2",
  T3: "Term 3",
};

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

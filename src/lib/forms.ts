import {
  DEGREE_OPTIONS,
  INTEREST_OPTIONS,
  MAX_SUBJECTS_PER_TERM,
  TERMS,
  normalizeEmail,
  normalizeSubjectCode,
  normalizeZid,
  type Interest,
  type Term,
} from "@/lib/constants";
import { parseTimeToMinutes } from "@/lib/timetable";
import type { FormState, SubjectSelection, SubjectsByTerm, TimetableBlock } from "@/lib/types";

type FormSuccess<T> = { data: T };
type FormFailure = { error: FormState };

export function readSubjectsFromFormData(
  formData: FormData,
): FormSuccess<SubjectsByTerm> | FormFailure {
  const subjects = {} as SubjectsByTerm;

  for (const term of TERMS) {
    const rawValues = formData.getAll(term);
    const parsedValues: SubjectSelection[] = [];

    for (const rawValue of rawValues) {
      if (!rawValue) continue;

      try {
        const parsed = JSON.parse(String(rawValue)) as {
          code?: string;
          name?: string;
        };
        const code = normalizeSubjectCode(parsed.code ?? "");
        const name = String(parsed.name ?? "").trim();

        if (!code || !name) {
          continue;
        }

        if (!/^[A-Z]{4}\d{4}$/.test(code)) {
          return {
            error: {
              error: `${term} subjects must use a real UNSW course like COMP1531.`,
            },
          };
        }

        parsedValues.push({ code, name });
      } catch {
        return {
          error: {
            error: `${term} contains an invalid subject selection. Please choose a subject from the search list.`,
          },
        };
      }
    }

    const uniqueCodes = [...new Set(parsedValues.map((value) => value.code))];

    if (uniqueCodes.length !== parsedValues.length) {
      return {
        error: {
          error: `${term} has duplicate subjects. Choose each course only once.`,
        },
      };
    }

    if (parsedValues.length > MAX_SUBJECTS_PER_TERM) {
      return {
        error: {
          error: `${term} can only have up to ${MAX_SUBJECTS_PER_TERM} subjects.`,
        },
      };
    }

    subjects[term] = parsedValues;
  }

  return { data: subjects };
}

export function readLoginCredentials(formData: FormData): FormSuccess<{
  email: string;
  password: string;
}> | FormFailure {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!/^[^@\s]+@(?:[\w-]+\.)*unsw\.edu\.au$/i.test(email)) {
    return {
      error: {
        error: "Use your real UNSW email address ending in unsw.edu.au.",
      },
    };
  }

  if (password.length < 8) {
    return {
      error: {
        error: "Password must be at least 8 characters long.",
      },
    };
  }

  return { data: { email, password } };
}

export function readSignUpDetails(formData: FormData): FormSuccess<{
  fullName: string;
  zid: string;
  email: string;
  password: string;
  degree: string;
  enrolledYear: number;
  enrolledTerm: Term;
}> | FormFailure {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const zid = normalizeZid(String(formData.get("zid") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const degree = String(formData.get("degree") ?? "").trim();
  const enrolledYear = Number(formData.get("enrolled_year"));
  const enrolledTerm = String(formData.get("enrolled_term") ?? "") as Term;
  const currentYear = new Date().getFullYear();

  if (fullName.length < 2) {
    return {
      error: {
        error: "Enter your full name.",
      },
    };
  }

  if (!/^z\d{7}$/.test(zid)) {
    return {
      error: {
        error: "zID must look like z1234567.",
      },
    };
  }

  if (!/^[^@\s]+@(?:[\w-]+\.)*unsw\.edu\.au$/i.test(email)) {
    return {
      error: {
        error: "Use your real UNSW email address ending in unsw.edu.au.",
      },
    };
  }

  if (password.length < 8) {
    return {
      error: {
        error: "Password must be at least 8 characters long.",
      },
    };
  }

  if (!degree || !(DEGREE_OPTIONS as readonly string[]).includes(degree)) {
    return {
      error: {
        error: "Choose your degree.",
      },
    };
  }

  if (!Number.isInteger(enrolledYear) || enrolledYear < currentYear - 12 || enrolledYear > currentYear + 1) {
    return {
      error: {
        error: "Choose the year you enrolled.",
      },
    };
  }

  if (!TERMS.includes(enrolledTerm)) {
    return {
      error: {
        error: "Choose the term you enrolled in.",
      },
    };
  }

  return { data: { fullName, zid, email, password, degree, enrolledYear, enrolledTerm } };
}

export function buildEmptySubjects(): SubjectsByTerm {
  return {
    T1: [],
    T2: [],
    T3: [],
  };
}

export function groupSubjectsByTerm(
  rows: Array<{ term: Term; subject_code: string; subject_name: string }>,
): SubjectsByTerm {
  const grouped = buildEmptySubjects();

  for (const row of rows) {
    grouped[row.term].push({
      code: row.subject_code,
      name: row.subject_name,
    });
  }

  for (const term of TERMS) {
    grouped[term] = [...grouped[term]].sort((left, right) =>
      left.code.localeCompare(right.code),
    );
  }

  return grouped;
}

export function getCommonSubjects(
  left: SubjectsByTerm,
  right: SubjectsByTerm,
): SubjectsByTerm {
  const common = buildEmptySubjects();

  for (const term of TERMS) {
    const rightCodes = new Set(right[term].map((subject) => subject.code));
    common[term] = left[term].filter((subject) => rightCodes.has(subject.code));
  }

  return common;
}

export function readInterestsFromFormData(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("interests")
        .map((value) => String(value))
        .filter((value): value is Interest =>
          (INTEREST_OPTIONS as readonly string[]).includes(value),
        ),
    ),
  ].slice(0, 12);
}

export function readSettingsFromFormData(formData: FormData): FormSuccess<{
  interests: Interest[];
  degree: string | null;
  enrolledYear: number | null;
  enrolledTerm: Term | null;
  term: Term;
  sourceType: "manual" | "calendar_url";
  calendarUrl: string | null;
  blocks: Array<Pick<TimetableBlock, "term" | "start_at" | "end_at" | "day_of_week" | "start_minutes" | "end_minutes" | "label" | "location">>;
}> | FormFailure {
  const interests = readInterestsFromFormData(formData);
  const degree = String(formData.get("degree") ?? "").trim() || null;
  const enrolledYearRaw = String(formData.get("enrolled_year") ?? "").trim();
  const enrolledYear = enrolledYearRaw ? Number(enrolledYearRaw) : null;
  const enrolledTermRaw = String(formData.get("enrolled_term") ?? "").trim();
  const enrolledTerm = enrolledTermRaw ? (enrolledTermRaw as Term) : null;
  const term = String(formData.get("term") ?? "") as Term;
  const sourceType = String(formData.get("source_type") ?? "manual");
  const calendarUrl = String(formData.get("calendar_url") ?? "").trim() || null;
  const currentYear = new Date().getFullYear();

  if (degree && !(DEGREE_OPTIONS as readonly string[]).includes(degree)) {
    return { error: { error: "Choose a valid degree." } };
  }

  if (
    enrolledYear !== null &&
    (!Number.isInteger(enrolledYear) || enrolledYear < currentYear - 12 || enrolledYear > currentYear + 1)
  ) {
    return { error: { error: "Choose a valid enrolment year." } };
  }

  if (enrolledTerm && !TERMS.includes(enrolledTerm)) {
    return { error: { error: "Choose a valid enrolment term." } };
  }

  if (!TERMS.includes(term)) {
    return { error: { error: "Choose a valid term." } };
  }

  if (sourceType !== "manual" && sourceType !== "calendar_url") {
    return { error: { error: "Choose a valid timetable source." } };
  }

  if (sourceType === "calendar_url" && !calendarUrl) {
    return { error: { error: "Paste your public calendar .ics link or switch to manual entry." } };
  }

  if (calendarUrl) {
    try {
      const parsed = new URL(calendarUrl);
      const supportedProtocols = ["webcal:", "webcals:", "ical:", "icals:", "http:", "https:"];
      const looksLikeCalendarFeed =
        parsed.pathname.toLowerCase().endsWith(".ics") ||
        parsed.href.toLowerCase().includes(".ics") ||
        parsed.href.toLowerCase().includes("calendar") ||
        parsed.href.toLowerCase().includes("ical");

      if (!supportedProtocols.includes(parsed.protocol) || !looksLikeCalendarFeed) {
        return {
          error: {
            error: "Paste a valid calendar feed URL such as webcal://...ics, icals://...ics, http://...ics, or https://...ics.",
          },
        };
      }
    } catch {
      return { error: { error: "Paste a valid calendar link." } };
    }
  }

  const blocks = formData
    .getAll("timetable_blocks")
    .map((value) => String(value))
    .filter(Boolean)
    .map((value) => {
      try {
        return JSON.parse(value) as {
          day?: number;
          start?: string;
          end?: string;
          label?: string;
          location?: string;
        };
      } catch {
        return null;
      }
    });

  if (blocks.some((block) => block === null)) {
    return { error: { error: "One timetable block could not be read." } };
  }

  const parsedBlocks = [];
  for (const block of blocks) {
    if (!block) continue;

    const day = Number(block.day);
    const startMinutes = parseTimeToMinutes(String(block.start ?? ""));
    const endMinutes = parseTimeToMinutes(String(block.end ?? ""));
    const label = String(block.label ?? "").trim() || "Busy";
    const location = String(block.location ?? "").trim() || null;

    if (!Number.isInteger(day) || day < 1 || day > 7 || startMinutes === null || endMinutes === null) {
      return { error: { error: "Each timetable block needs a valid day, start time, and end time." } };
    }

    if (startMinutes >= endMinutes) {
      return { error: { error: "Timetable block end times must be after start times." } };
    }

    parsedBlocks.push({
      term,
      start_at: null,
      end_at: null,
      day_of_week: day,
      start_minutes: startMinutes,
      end_minutes: endMinutes,
      label: label.slice(0, 120),
      location: location?.slice(0, 160) ?? null,
    });
  }

  return {
    data: {
      interests,
      degree,
      enrolledYear,
      enrolledTerm,
      term,
      sourceType,
      calendarUrl,
      blocks: parsedBlocks,
    },
  };
}

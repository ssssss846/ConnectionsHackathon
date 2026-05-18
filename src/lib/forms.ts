import {
  MAX_SUBJECTS_PER_TERM,
  TERMS,
  normalizeEmail,
  normalizeSubjectCode,
  normalizeZid,
  type Term,
} from "@/lib/constants";
import type { FormState, SubjectSelection, SubjectsByTerm } from "@/lib/types";

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
}> | FormFailure {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const zid = normalizeZid(String(formData.get("zid") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

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

  return { data: { fullName, zid, email, password } };
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

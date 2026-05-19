import { type Term } from "@/lib/constants";
import type { PlannerClassOption, PlannerClassTime, SubjectSelection } from "@/lib/types";

const UNSW_GRAPHQL_ENDPOINT = "https://graphql.csesoc.app/v1/graphql";
const UNSW_CACHE_MS = 10 * 60 * 1000;

type CourseRecord = {
  course_code: string;
  course_name: string;
  terms: string[] | null;
  year: number;
};

type ClassRecord = {
  class_id: string;
  class_nr: string;
  activity: string;
  section: string;
  term: string;
  course: {
    course_code: string;
    course_name: string;
  };
  times: Array<{
    time_id: string;
    day: string;
    time: string;
    location: string;
    weeks: string;
    instructor?: string | null;
  }>;
};

const courseSearchCache = new Map<string, { expiresAt: number; subjects: SubjectSelection[] }>();
const plannerClassesCache = new Map<string, { expiresAt: number; options: Map<string, PlannerClassOption[]> }>();

function getCurrentYear() {
  return new Date().getFullYear();
}

function parseTimeRange(range: string) {
  const [start, end] = range.split(" - ").map((part) => part.trim());
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  };
}

export async function searchUnswCourses(query: string, term: Term) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const cacheKey = JSON.stringify({
    query: normalizedQuery.toLowerCase(),
    term,
    year: getCurrentYear(),
  });
  const cached = courseSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.subjects;
  }

  const response = await fetch(UNSW_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query SearchCourses($query: String!, $year: Int!) {
          courses(
            where: {
              year: { _eq: $year }
              _or: [
                { course_code: { _ilike: $query } }
                { course_name: { _ilike: $query } }
              ]
            }
            limit: 20
            order_by: { course_code: asc }
          ) {
            course_code
            course_name
            terms
            year
          }
        }
      `,
      variables: {
        query: `%${normalizedQuery}%`,
        year: getCurrentYear(),
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not reach the UNSW subject API.");
  }

  const payload = (await response.json()) as {
    data?: { courses?: CourseRecord[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Course search failed.");
  }

  const deduped = new Map<string, SubjectSelection>();

  for (const course of payload.data?.courses ?? []) {
    if (course.terms && !course.terms.includes(term)) {
      continue;
    }

    deduped.set(course.course_code, {
      code: course.course_code,
      name: course.course_name,
    });
  }

  const subjects = [...deduped.values()].slice(0, 8);
  courseSearchCache.set(cacheKey, { expiresAt: Date.now() + UNSW_CACHE_MS, subjects });
  return subjects;
}

export async function fetchPlannerClasses(subjectCodes: string[], term: Term) {
  if (!subjectCodes.length) {
    return new Map<string, PlannerClassOption[]>();
  }

  const uniqueSubjectCodes = [...new Set(subjectCodes)].sort();
  const cacheKey = JSON.stringify({ codes: uniqueSubjectCodes, term, year: getCurrentYear() });
  const cached = plannerClassesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.options;
  }

  const response = await fetch(UNSW_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query PlannerClasses($codes: [String!], $term: String!, $year: Int!) {
          classes(
            where: {
              course: { course_code: { _in: $codes } }
              term: { _eq: $term }
              year: { _eq: $year }
            }
            order_by: [{ course_id: asc }, { activity: asc }, { section: asc }]
          ) {
            class_id
            class_nr
            activity
            section
            term
            course {
              course_code
              course_name
            }
            times {
              time_id
              day
              time
              location
              weeks
              instructor
            }
          }
        }
      `,
      variables: {
        codes: uniqueSubjectCodes,
        term,
        year: getCurrentYear(),
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Could not reach the UNSW class API.");
  }

  const payload = (await response.json()) as {
    data?: { classes?: ClassRecord[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Class search failed.");
  }

  const grouped = new Map<string, PlannerClassOption[]>();

  for (const classOption of payload.data?.classes ?? []) {
    if (!classOption.times.length) {
      continue;
    }

    const mappedTimes: PlannerClassTime[] = classOption.times.map((time) => ({
      timeId: time.time_id,
      day: time.day,
      time: time.time,
      location: time.location,
      weeks: time.weeks,
      instructor: time.instructor ?? null,
      ...parseTimeRange(time.time),
    }));

    const mappedOption: PlannerClassOption = {
      classId: classOption.class_id,
      classNumber: classOption.class_nr,
      activity: classOption.activity,
      section: classOption.section,
      subjectCode: classOption.course.course_code,
      subjectName: classOption.course.course_name,
      times: mappedTimes,
    };

    const current = grouped.get(classOption.course.course_code) ?? [];
    current.push(mappedOption);
    grouped.set(classOption.course.course_code, current);
  }

  plannerClassesCache.set(cacheKey, { expiresAt: Date.now() + UNSW_CACHE_MS, options: grouped });
  return grouped;
}

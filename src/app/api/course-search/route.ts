import { NextResponse } from "next/server";

import { TERMS, type Term } from "@/lib/constants";
import { searchUnswCourses } from "@/lib/unsw-courses";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? "");
  const term = String(searchParams.get("term") ?? "") as Term;

  if (!TERMS.includes(term)) {
    return NextResponse.json({ error: "Invalid term." }, { status: 400 });
  }

  try {
    const courses = await searchUnswCourses(query, term);
    return NextResponse.json({ courses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not search courses.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

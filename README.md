# UNSW Mates

UNSW Mates is a Next.js and Supabase web app for UNSW students to find friends, compare subjects, build shared timetables, and discover events that fit their group availability.

The app is built for a hackathon flow, but it has a real backend: Supabase Auth, Postgres tables with row-level security, live UNSW course/class lookup, Rubric event recommendations, and calendar/timetable import.

## Features

- UNSW email sign up and login with full name, zID, degree, enrolment year, and enrolment term.
- Subject onboarding for `T1`, `T2`, and `T3`, with up to 4 courses per term.
- Friend search, incoming/outgoing requests, accepted friend lists, and friend detail pages.
- Shared and personal timetable planners with selectable class options.
- Multi-participant planning for common and individual subjects.
- Settings for subjects, interests, degree metadata, and timetable availability.
- Manual timetable blocks or imported calendar feeds from `.ics`, `webcal`, `ical`, `http`, or `https` URLs.
- Event recommendations using group interests, shared free time, and registered events.

## Tech Stack

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- Supabase Auth, Postgres, and RLS
- Server Actions for mutations
- CSESoc GraphQL for UNSW course and class data
- Rubric/QPay endpoints for UNSW event data

## Getting Started
https://unswmates.vercel.app/

## Project Structure

```text
src/app/                  App Router pages, layouts, route handlers, and Server Actions
src/app/actions.ts        Server Actions for auth, friends, plans, events, settings, and subjects
src/components/           Client and server UI components
src/lib/constants.ts      Terms, degrees, interests, and normalization helpers
src/lib/data.ts           Server-side data loading and page view models
src/lib/forms.ts          Form parsing and validation
src/lib/recommendations.ts Event recommendation pipeline
src/lib/rubric-events.ts  Rubric/QPay event fetcher
src/lib/timetable.ts      ICS parsing, free-slot calculation, and timetable utilities
src/lib/unsw-courses.ts   CSESoc GraphQL course and class lookup
src/lib/supabase/         Supabase browser/server/proxy helpers
src/proxy.ts              Next 16 Proxy for Supabase session refresh
supabase/schema.sql       Database tables, functions, indexes, and RLS policies
```

## Database Model

The schema creates these main tables:

- `profiles`
- `user_term_subjects`
- `friend_requests`
- `friendships`
- `shared_term_plans`
- `shared_term_plan_participants`
- `shared_term_plan_subjects`
- `shared_term_plan_class_choices`
- `user_interests`
- `registered_events`
- `user_timetable_sources`
- `user_timetable_blocks`

Important database details:

- RLS is enabled on all app tables.
- Profiles are readable by authenticated users so friend search can work.
- Subjects, interests, timetable sources, and timetable blocks are readable by self or accepted friends.
- Friendships store normalized user pairs with `least`/`greatest` ordering.
- Shared plans are owner-visible. Participant copies are synced by `sync_shared_plan_copies`.
- Profile search uses `pg_trgm` indexes for full name, zID, and UNSW email.

## External Data

Course and class lookup uses:

```text
https://graphql.csesoc.app/v1/graphql
```

Event recommendations use:

```text
https://api.hellorubric.com
https://appserver.getqpay.com:9090/AppServerSwapnil/event/details
```

Both integrations use in-memory caches. Course/class data is cached for 10 minutes. Rubric event data is cached for 5 minutes. These caches reset when the server process restarts.

## Next.js 16 Notes

This project uses Next.js 16 conventions. Before editing Next-specific code, read the relevant docs under:

```text
node_modules/next/dist/docs/
```

Two conventions matter in this codebase:

- Request `params` and `searchParams` are promises in App Router pages, so pages `await` them.
- Middleware is now called Proxy. Supabase session refresh lives in `src/proxy.ts`.

Server mutations live in `src/app/actions.ts` with `"use server"`. These functions are reachable by POST, so each action must perform its own auth and authorization checks.

## Known Risks

- The app depends on external UNSW/CSESoc and Rubric/QPay APIs. If those APIs fail or change response shape, search, planner classes, or event recommendations can degrade.
- Calendar import is custom ICS parsing. It handles common weekly recurrence patterns, time zones, and exclusions, but unusual feeds may need extra parser work.
- RLS policy changes must be applied carefully. Many frontend flows rely on exact self/friend/owner access behavior.
- Public authenticated profile search is intentional for the hackathon app, but it is a privacy tradeoff.



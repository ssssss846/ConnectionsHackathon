# UNSW Mates

UNSW Mates is a Next.js + Supabase web app for UNSW students to compare subjects with friends and create lightweight shared term plans.

## Features

- Username + password sign up and login
- Subject onboarding for `T1`, `T2`, and `T3` with a max of 4 subjects each
- Friend search, requests, and accepted friend lists
- Friend detail pages showing yearly subjects and common subjects
- Shared term plans with notes and selected subjects

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and anon key.
3. Run the SQL in [supabase/schema.sql](/home/samuel/Hackathon-stuff/supabase/schema.sql).
4. In Supabase Auth, keep email confirmation disabled for the hackathon flow.
5. Start the app with `npm run dev`.

## Auth note

The UI asks for `username + password`, but Supabase Auth still requires an email internally. This app derives a hidden synthetic email from the username so the user experience stays username-first.

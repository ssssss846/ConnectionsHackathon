import Image from "next/image";
import Link from "next/link";

import { registerEventAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { TimetableView } from "@/components/timetable-view";
import { getEventRecommendationsData } from "@/lib/recommendations";

type EventsSearchParams = {
  friend?: string | string[];
  notice?: string;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Upcoming";

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  }).format(new Date(value));
}

function normalizeSelectedFriends(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildEventsReturnTo(friendIds: string[]) {
  const params = new URLSearchParams();
  for (const id of friendIds) {
    params.append("friend", id);
  }

  return params.size ? `/events?${params.toString()}` : "/events";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<EventsSearchParams>;
}) {
  const params = await searchParams;
  const data = await getEventRecommendationsData(normalizeSelectedFriends(params.friend));
  const participantLabel = data.selectedFriends.length
    ? ["You", ...data.selectedFriends.map((friend) => friend.full_name)].join(", ")
    : "You";
  const returnTo = buildEventsReturnTo(data.selectedFriendIds);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Arc event recommendations
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Find a time everyone can actually make</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Recommendations use your timetable, selected friends&apos; timetables, and saved interests to suggest Arc @ UNSW events from Rubric.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
              <span className="rounded-full bg-[var(--card-strong)] px-3 py-2">
                {data.participantCount} {data.participantCount === 1 ? "person" : "people"}
              </span>
              <span className="rounded-full bg-[var(--card-strong)] px-3 py-2">
                {data.sharedFreeSlots.length} shared free windows
              </span>
              <span className="rounded-full bg-[var(--card-strong)] px-3 py-2">
                {data.sharedInterests.length || "No"} shared interests
              </span>
            </div>
          </div>
          <form className="space-y-4" action="/events">
            <div>
              <p className="text-sm font-semibold">Choose friends</p>
              <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">
                {data.friends.length ? (
                  data.friends.map((friend) => (
                    <label
                      key={friend.id}
                      className="cursor-pointer rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--muted)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)] has-[:checked]:text-[var(--accent-strong)]"
                    >
                      <input
                        type="checkbox"
                        name="friend"
                        value={friend.id}
                        defaultChecked={data.selectedFriendIds.includes(friend.id)}
                        className="sr-only"
                      />
                      {friend.full_name}
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">Add friends to search shared free time.</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Update recommendations
            </button>
          </form>
        </div>
      </section>

      {data.setupWarnings.length ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <ul className="space-y-2">
            {data.setupWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <Link href="/settings" className="mt-4 inline-flex font-semibold underline">
            Open Settings
          </Link>
        </section>
      ) : null}

      {params.notice ? <Notice tone="success" message={params.notice} /> : null}
      {params.error ? <Notice tone="error" message={params.error} /> : null}

      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <h2 className="text-xl font-semibold">Free time and Events Calendar</h2>
        <div className="mt-5">
          <TimetableView
            blocks={data.calendarBlocks}
            freeSlots={data.sharedFreeSlots}
            sharedParticipantLabel={participantLabel}
            emptyMessage="No shared free time found for this group."
            showLayerControls
            interestLabels={data.sharedInterests}
          />
        </div>
      </section>

      {data.recommendations.length ? (
        <section id="recommended-events" className="space-y-5">
          <h2 className="text-2xl font-semibold">Suggested Events</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {data.recommendations.map((event) => (
            <article
              key={event.id}
              id={`event-${event.id}`}
              className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]"
            >
              {event.imageUrl ? (
                <Image
                  src={event.imageUrl}
                  alt=""
                  width={800}
                  height={320}
                  className="h-48 w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="space-y-4 p-6">
                <div className="flex items-start gap-3">
                  {event.clubLogoUrl ? (
                    <Image
                      src={event.clubLogoUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                      {event.category}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{event.title}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">{event.clubName}</p>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                  <p className="rounded-2xl bg-[var(--card-strong)] px-3 py-2">
                    {event.timeLabel || formatDate(event.startsAt)}
                  </p>
                  <p className="rounded-2xl bg-[var(--card-strong)] px-3 py-2">{event.price}</p>
                  <p className="rounded-2xl bg-[var(--card-strong)] px-3 py-2 sm:col-span-2">
                    {event.location}
                  </p>
                </div>

                {event.description ? (
                  <p className="line-clamp-4 text-sm leading-6 text-[var(--muted)]">{event.description}</p>
                ) : null}

                {event.matchedInterests.length ? (
                  <div className="flex flex-wrap gap-2">
                    {event.matchedInterests.map((interest) => (
                      <span
                        key={interest}
                        className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-semibold capitalize text-[var(--accent-strong)]"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Sign up on Rubric
                  </a>
                  {event.isRegistered ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700"
                    >
                      Registered
                    </button>
                  ) : (
                    <form action={registerEventAction}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="title" value={event.title} />
                      <input type="hidden" name="club_name" value={event.clubName} />
                      <input type="hidden" name="category" value={event.category} />
                      <input type="hidden" name="starts_at" value={event.startsAt ?? ""} />
                      <input type="hidden" name="ends_at" value={event.endsAt ?? ""} />
                      <input type="hidden" name="time_label" value={event.timeLabel} />
                      <input type="hidden" name="location" value={event.location} />
                      <input type="hidden" name="url" value={event.url} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button className="inline-flex rounded-full border border-violet-300 bg-violet-100/70 px-4 py-2 text-sm font-semibold text-violet-800 transition hover:bg-violet-200">
                        Mark as registered
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow)]">
          <h2 className="text-xl font-semibold">No events found</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add more free time, update interests, or try a different friend group.
          </p>
        </section>
      )}
    </div>
  );
}

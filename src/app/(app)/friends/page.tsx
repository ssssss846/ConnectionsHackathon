import Link from "next/link";

import {
  respondToFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/actions";
import { Notice } from "@/components/notice";
import { PendingButton } from "@/components/pending-button";
import { getFriendsData } from "@/lib/data";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const data = await getFriendsData(params.query);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Friends
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Build your study circle.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Search classmates by name, zID, or UNSW email, accept requests, and compare subjects term by term.
          </p>
        </div>

        <form
          action="/friends"
          className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm"
        >
          <h2 className="text-xl font-semibold">Find a friend</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Search by exact or partial name, zID, or UNSW email.
          </p>
          <div className="mt-5 flex gap-3">
            <input
              name="query"
              defaultValue={params.query ?? ""}
              placeholder="Search name, zID, or UNSW email"
              className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white/90 px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
            />
            <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
              Search
            </button>
          </div>
        </form>
      </section>

      {params.notice ? <Notice tone="success" message={params.notice} /> : null}
      {params.error ? <Notice tone="error" message={params.error} /> : null}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Current friends</h2>
          <div className="mt-4 space-y-3">
            {data.friends.length ? (
              data.friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/friends/${friend.id}`}
                  className="block rounded-2xl bg-[var(--card-strong)] px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <p className="font-semibold">{friend.full_name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{friend.zid}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No accepted friends yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Incoming requests</h2>
          <div className="mt-4 space-y-3">
            {data.incomingRequests.length ? (
              data.incomingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-[var(--card-strong)] p-4">
                  <p className="font-semibold">{request.sender?.full_name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{request.sender?.zid}</p>
                  <div className="mt-3 flex gap-2">
                    <form action={respondToFriendRequestAction}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <PendingButton
                        pendingLabel="Accepting..."
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Accept
                      </PendingButton>
                    </form>
                    <form action={respondToFriendRequestAction}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <PendingButton
                        pendingLabel="Declining..."
                        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                      >
                        Decline
                      </PendingButton>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No incoming requests right now.</p>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Outgoing requests</h2>
          <div className="mt-4 space-y-3">
            {data.outgoingRequests.length ? (
              data.outgoingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-[var(--card-strong)] p-4">
                  <p className="font-semibold">{request.receiver?.full_name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{request.receiver?.zid}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Waiting for them to respond.</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">You have no pending sent requests.</p>
            )}
          </div>
        </div>
      </section>

      {params.query ? (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
          <h2 className="text-xl font-semibold">Search results</h2>
          <div className="mt-4 space-y-3">
            {data.searchResults.length ? (
              data.searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-col gap-3 rounded-2xl bg-[var(--card-strong)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{result.full_name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {result.zid} · {result.unsw_email}
                    </p>
                  </div>
                  <form action={sendFriendRequestAction}>
                    <input type="hidden" name="recipient_id" value={result.id} />
                    <input type="hidden" name="return_to" value={`/friends?query=${params.query}`} />
                    <PendingButton
                      pendingLabel="Sending..."
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Add friend
                    </PendingButton>
                  </form>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No available users matched that search.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
        <div id="same-degree" className="scroll-mt-8" />
        <h2 className="text-xl font-semibold">Friends taking your degree</h2>
        <div className="mt-4 space-y-3">
          {data.sameDegreeFriends.length ? (
            data.sameDegreeFriends.map((friend) => (
              <Link
                key={friend.id}
                href={`/friends/${friend.id}`}
                className="block rounded-2xl bg-[var(--card-strong)] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-semibold">{friend.full_name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {friend.degree} · {friend.zid}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No accepted friends have the same degree saved yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
        <h2 className="text-xl font-semibold">Mutuals taking your degree</h2>
        <div className="mt-4 space-y-3">
          {data.degreeMutuals.length ? (
            data.degreeMutuals.map((mutual) => (
              <div
                key={mutual.id}
                className="flex flex-col gap-3 rounded-2xl bg-[var(--card-strong)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{mutual.full_name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {mutual.degree} · {mutual.mutual_friend_count} mutual {mutual.mutual_friend_count === 1 ? "friend" : "friends"}
                  </p>
                </div>
                <form action={sendFriendRequestAction}>
                  <input type="hidden" name="recipient_id" value={mutual.id} />
                  <input type="hidden" name="return_to" value="/friends#same-degree" />
                  <PendingButton
                    pendingLabel="Sending..."
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Add friend
                  </PendingButton>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No same-degree mutuals found through your friends yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] backdrop-blur-sm">
        <h2 className="text-xl font-semibold">Friends taking the same subjects</h2>
        <div className="mt-4 space-y-3">
          {data.sharedSubjectsByFriend.length ? (
            data.sharedSubjectsByFriend.map((entry) => (
              <Link
                key={entry.friend.id}
                href={`/friends/${entry.friend.id}`}
                className="block rounded-2xl bg-[var(--card-strong)] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <p className="font-semibold">{entry.friend.full_name}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{entry.friend.zid}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.shared.map((subject) => (
                    <span
                      key={`${entry.friend.id}-${subject.term}-${subject.code}`}
                      className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]"
                    >
                      {subject.term}: {subject.code}
                    </span>
                  ))}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No friends currently share a subject with you.</p>
          )}
        </div>
      </section>
    </div>
  );
}

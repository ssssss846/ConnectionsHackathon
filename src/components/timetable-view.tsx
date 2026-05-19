"use client";

import { useMemo, useState } from "react";

import { WEEK_DAYS } from "@/lib/constants";
import { formatMinutes, getDayLabel } from "@/lib/timetable";
import type { FreeTimeSlot, TimetableBlock } from "@/lib/types";

type TimetableViewProps = {
  blocks: TimetableBlock[];
  freeSlots?: FreeTimeSlot[];
  emptyMessage?: string;
  sharedParticipantLabel?: string;
  showFreeSlots?: boolean;
};

type CalendarView = "month" | "week" | "day";

const HOURS = Array.from({ length: 15 }, (_, index) => index + 8);
const START_MINUTES = 8 * 60;
const END_MINUTES = 22 * 60;
const PX_PER_MINUTE = 1;
const GRID_HEIGHT = (END_MINUTES - START_MINUTES) * PX_PER_MINUTE;

function durationLabel(startMinutes: number, endMinutes: number) {
  const minutes = endMinutes - startMinutes;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function getMonday(date: Date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getMonthCells(anchorDate: Date) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getWeekDates(anchorDate: Date) {
  const monday = getMonday(anchorDate);
  return WEEK_DAYS.map((day, index) => ({
    ...day,
    date: addDays(monday, index),
  }));
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getViewTitle(view: CalendarView, date: Date) {
  if (view === "month") return formatMonthYear(date);
  if (view === "week") return `Week of ${formatShortDate(getMonday(date))}`;
  return formatFullDate(date);
}

function getBlockId(block: TimetableBlock) {
  return (
    block.id ??
    `${block.start_at ?? "weekly"}-${block.day_of_week}-${block.start_minutes}-${block.end_minutes}-${block.label}`
  );
}

function getDayOfWeek(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function slotMatchesDate(slot: FreeTimeSlot, date: Date) {
  return slot.date ? slot.date === formatDateKey(date) : slot.dayOfWeek === getDayOfWeek(date);
}

function parseBlockDate(block: TimetableBlock) {
  if (!block.start_at) return null;

  const date = new Date(block.start_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

function blockMatchesDate(block: TimetableBlock, date: Date) {
  const blockDate = parseBlockDate(block);
  if (blockDate) {
    return isSameCalendarDate(blockDate, date);
  }

  return block.day_of_week === getDayOfWeek(date);
}

function blocksOverlap(left: TimetableBlock, right: TimetableBlock) {
  return left.start_minutes < right.end_minutes && right.start_minutes < left.end_minutes;
}

type PositionedBlock = TimetableBlock & {
  overlapIndex: number;
  overlapCount: number;
  isOverlapping: boolean;
};

function layoutCluster(cluster: TimetableBlock[]): PositionedBlock[] {
  const columnEnds: number[] = [];
  const placed = cluster.map((block) => {
    const availableColumn = columnEnds.findIndex((endMinutes) => endMinutes <= block.start_minutes);
    const overlapIndex = availableColumn === -1 ? columnEnds.length : availableColumn;
    columnEnds[overlapIndex] = block.end_minutes;

    return {
      ...block,
      overlapIndex,
    };
  });
  const overlapCount = Math.max(1, columnEnds.length);
  const isOverlapping = cluster.some((block, index) =>
    cluster.some((otherBlock, otherIndex) => index !== otherIndex && blocksOverlap(block, otherBlock)),
  );

  return placed.map((block) => ({
    ...block,
    overlapCount,
    isOverlapping,
  }));
}

function layoutDayBlocks(blocks: TimetableBlock[]) {
  const sorted = [...blocks].sort((left, right) => {
    if (left.start_minutes !== right.start_minutes) return left.start_minutes - right.start_minutes;
    return left.end_minutes - right.end_minutes;
  });
  const positioned: PositionedBlock[] = [];
  let cluster: TimetableBlock[] = [];
  let clusterEnd = -1;

  for (const block of sorted) {
    if (!cluster.length || block.start_minutes < clusterEnd) {
      cluster.push(block);
      clusterEnd = Math.max(clusterEnd, block.end_minutes);
      continue;
    }

    positioned.push(...layoutCluster(cluster));
    cluster = [block];
    clusterEnd = block.end_minutes;
  }

  if (cluster.length) {
    positioned.push(...layoutCluster(cluster));
  }

  return positioned;
}

export function TimetableView({
  blocks,
  freeSlots = [],
  emptyMessage = "No busy blocks saved yet.",
  sharedParticipantLabel = "Everyone selected",
  showFreeSlots = true,
}: TimetableViewProps) {
  const [view, setView] = useState<CalendarView>("week");
  const [visibleDate, setVisibleDate] = useState(() => new Date());
  const selectedDay = useMemo(() => {
    const day = visibleDate.getDay();
    return day === 0 ? 7 : day;
  }, [visibleDate]);
  const initialDay = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);
  const monthCells = useMemo(() => getMonthCells(visibleDate), [visibleDate]);
  const weekDates = useMemo(() => getWeekDates(visibleDate), [visibleDate]);

  function moveView(direction: -1 | 1) {
    setVisibleDate((current) => {
      if (view === "month") return addMonths(current, direction);
      if (view === "week") return addDays(current, direction * 7);
      return addDays(current, direction);
    });
  }

  function moveToToday() {
    setVisibleDate(new Date());
  }

  function changeSelectedDay(dayOfWeek: number) {
    const monday = getMonday(visibleDate);
    setVisibleDate(addDays(monday, dayOfWeek - 1));
  }

  const visibleDays = view === "day" ? weekDates.filter((day) => day.value === selectedDay) : weekDates;

  return (
    <section className="overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-lg font-semibold">{getViewTitle(view, visibleDate)}</p>
          <p className="text-xs text-[var(--muted)]">
            {view === "month" ? "Month view" : view === "week" ? "Week view" : "Day view"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white/80 p-1">
            <button
              type="button"
              onClick={() => moveView(-1)}
              aria-label="Previous"
              className="rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--card-strong)]"
            >
              &lt;
            </button>
            <button
              type="button"
              onClick={moveToToday}
              className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-bold text-[var(--accent-strong)] transition hover:bg-[var(--accent)] hover:text-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => moveView(1)}
              aria-label="Next"
              className="rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--card-strong)]"
            >
              &gt;
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(["month", "week", "day"] as CalendarView[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setView(option);
                  if (option === "day" && selectedDay !== initialDay) {
                    changeSelectedDay(selectedDay);
                  }
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                  view === option
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {view === "day" ? (
          <select
            value={selectedDay}
            onChange={(event) => changeSelectedDay(Number(event.target.value))}
            className="h-10 rounded-full border border-[var(--border)] bg-white px-4 text-sm font-semibold outline-none"
          >
            {WEEK_DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 border-b border-[var(--border)] text-xs font-semibold text-[var(--muted)]">
          {WEEK_DAYS.map((day) => (
            <div key={day.value} className="border-r border-[var(--border)] px-3 py-2 last:border-r-0">
              {day.short}
            </div>
          ))}
          {monthCells.map((date) => {
            const dayBlocks = layoutDayBlocks(blocks.filter((block) => blockMatchesDate(block, date)));
            const dayFreeSlots = freeSlots.filter((slot) => slotMatchesDate(slot, date));

            return (
              <div
                key={date.toISOString()}
                className={`min-h-32 border-r border-t border-[var(--border)] p-2 last:border-r-0 ${
                  date.getMonth() === visibleDate.getMonth() ? "bg-white/70" : "bg-[var(--card-strong)]/60"
                }`}
              >
                <p
                  className={`text-xs font-semibold ${
                    date.getMonth() === visibleDate.getMonth() ? "text-[var(--muted)]" : "text-[var(--muted)]/50"
                  }`}
                >
                  {date.getDate()}
                </p>
                <div className="mt-2 space-y-1">
                  {showFreeSlots
                    ? dayFreeSlots.slice(0, 2).map((slot) => (
                        <a
                          key={`month-free-${slot.date ?? slot.dayOfWeek}-${slot.startMinutes}-${slot.endMinutes}`}
                          href="#recommended-events"
                          title={`${sharedParticipantLabel} free from ${formatMinutes(slot.startMinutes)} to ${formatMinutes(slot.endMinutes)} (${durationLabel(slot.startMinutes, slot.endMinutes)})`}
                          className="block rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                        >
                          Free {formatMinutes(slot.startMinutes)}
                        </a>
                      ))
                    : null}
                  {dayBlocks.slice(0, 3).map((block) => (
                    <p
                      key={getBlockId(block)}
                      className={`truncate rounded-md px-2 py-1 text-[11px] font-semibold ${
                        block.isOverlapping || block.source_type === "auto_reference"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      }`}
                    >
                      {formatMinutes(block.start_minutes)} {block.label}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[760px]"
            style={{ gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(130px, 1fr))` }}
          >
            <div className="border-b border-r border-[var(--border)] bg-white/70" />
            {visibleDays.map((day) => (
              <div
                key={day.value}
                className="border-b border-r border-[var(--border)] bg-white/70 px-3 py-2 text-center text-sm font-semibold last:border-r-0"
              >
                <span>{getDayLabel(day.value, view === "week")}</span>
                <span className="ml-2 text-xs font-medium text-[var(--muted)]">
                  {formatShortDate(day.date)}
                </span>
              </div>
            ))}

            <div className="relative border-r border-[var(--border)] bg-white/70" style={{ height: GRID_HEIGHT }}>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-[var(--muted)]"
                  style={{ top: (hour * 60 - START_MINUTES) * PX_PER_MINUTE }}
                >
                  {formatMinutes(hour * 60)}
                </div>
              ))}
            </div>

            {visibleDays.map((day) => {
              const dayBlocks = layoutDayBlocks(blocks.filter((block) => blockMatchesDate(block, day.date)));
              const dayFreeSlots = freeSlots.filter((slot) => slotMatchesDate(slot, day.date));

              return (
                <div
                  key={day.value}
                  className="relative border-r border-[var(--border)] bg-white last:border-r-0"
                  style={{ height: GRID_HEIGHT }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-[var(--border)]/70"
                      style={{ top: (hour * 60 - START_MINUTES) * PX_PER_MINUTE }}
                    />
                  ))}

                  {showFreeSlots
                    ? dayFreeSlots.map((slot) => (
                        <a
                          key={`free-${slot.date ?? slot.dayOfWeek}-${slot.startMinutes}-${slot.endMinutes}`}
                          href="#recommended-events"
                          title={`${sharedParticipantLabel} free from ${formatMinutes(slot.startMinutes)} to ${formatMinutes(slot.endMinutes)} (${durationLabel(slot.startMinutes, slot.endMinutes)}). Click to find events in this slot.`}
                          className="absolute left-1 right-1 z-10 rounded-lg border border-emerald-300 bg-emerald-100/85 px-2 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-200"
                          style={{
                            top: (slot.startMinutes - START_MINUTES) * PX_PER_MINUTE,
                            height: Math.max(28, (slot.endMinutes - slot.startMinutes) * PX_PER_MINUTE),
                          }}
                        >
                          Shared free
                          <span className="block font-medium">
                            {formatMinutes(slot.startMinutes)} - {formatMinutes(slot.endMinutes)}
                          </span>
                        </a>
                      ))
                    : null}

                  {dayBlocks.map((block) => {
                    const id = getBlockId(block);
                    const columnWidth = 100 / block.overlapCount;
                    const overlapGap = block.isOverlapping ? 4 : 0;
                    const displayStart = Math.max(block.start_minutes, START_MINUTES);
                    const displayEnd = Math.min(block.end_minutes, END_MINUTES);
                    if (displayStart >= displayEnd) return null;
                    const isEventHighlight = block.source_type === "auto_reference";

                    return (
                      <div
                        key={id}
                        title={`${block.label}: ${formatMinutes(block.start_minutes)} to ${formatMinutes(block.end_minutes)}${block.location ? `, ${block.location}` : ""}`}
                        className={`absolute z-20 rounded-lg border px-2 py-1 text-xs font-semibold text-white shadow-md ${
                          block.isOverlapping || isEventHighlight
                            ? "border-orange-600 bg-orange-500"
                            : "border-[var(--accent)] bg-[var(--accent)]"
                        }`}
                        style={{
                          top: (displayStart - START_MINUTES) * PX_PER_MINUTE,
                          height: Math.max(30, (displayEnd - displayStart) * PX_PER_MINUTE),
                          left: `calc(${block.overlapIndex * columnWidth}% + ${8 + overlapGap}px)`,
                          width: `calc(${columnWidth}% - ${16 + overlapGap}px)`,
                        }}
                      >
                        <p className="truncate">{block.label}</p>
                        <p className="truncate text-[11px] font-medium text-white/85">
                          {formatMinutes(block.start_minutes)} - {formatMinutes(block.end_minutes)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!blocks.length && !freeSlots.length ? (
        <p className="px-5 py-4 text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : null}
    </section>
  );
}

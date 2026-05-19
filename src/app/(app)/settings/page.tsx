import { saveSettingsAndSubjectsAction } from "@/app/actions";
import { SettingsForm } from "@/components/settings-form";
import { SubjectFields } from "@/components/subject-form";
import { getSettingsData } from "@/lib/data";

export default async function SettingsPage() {
  const { profile, currentTerm, interests, subjectsByTerm, timetableBlocks, timetableSource } =
    await getSettingsData();

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Settings
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Personalise your planner</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Keep your courses, profile, interests, and timetable up to date so recommendations can find shared free time with friends.
        </p>
      </section>

      <SettingsForm
        action={saveSettingsAndSubjectsAction}
        profile={profile}
        currentTerm={currentTerm}
        selectedInterests={interests}
        timetableSource={timetableSource}
        timetableBlocks={timetableBlocks}
        submitLabel="Save changes"
      >
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Course selections</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              These are used for subject overlap and shared timetable planning.
            </p>
          </div>
          <SubjectFields defaultSubjects={subjectsByTerm} />
        </section>
      </SettingsForm>
    </div>
  );
}

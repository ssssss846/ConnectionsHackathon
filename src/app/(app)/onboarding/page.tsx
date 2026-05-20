import { saveOnboardingInterestsAction, saveSubjectsAction } from "@/app/actions";
import { OnboardingInterestsForm } from "@/components/onboarding-interests-form";
import { SubjectForm } from "@/components/subject-form";
import { buildEmptySubjects, groupSubjectsByTerm } from "@/lib/forms";
import { getUserSubjects, getViewerContext } from "@/lib/data";

export default async function OnboardingPage() {
  const { user, profile, profileError } = await getViewerContext();
  const existingSubjects = await getUserSubjects(user!.id);
  const defaults = existingSubjects.length
    ? groupSubjectsByTerm(existingSubjects)
    : buildEmptySubjects();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow)] backdrop-blur-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Step two
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Let&apos;s fill out your year{profile?.full_name ? `, ${profile.full_name}` : ""}.
        </h1>
        {!profile ? (
          <p className="mt-4 rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
            {profileError
              ? `We could not finish creating your profile: ${profileError}`
              : "We could not finish creating your profile yet. Please refresh and try again."}
          </p>
        ) : null}
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Search and select your planned UNSW subjects for each term. You can edit this later from the dashboard.
        </p>
      </section>

      <OnboardingInterestsForm action={saveOnboardingInterestsAction} />

      <section id="course-setup" className="scroll-mt-6">
        <SubjectForm
          action={saveSubjectsAction}
          defaultSubjects={defaults}
          submitLabel="Finish setup"
          redirectTo="/dashboard?notice=Welcome%20to%20UNSW%20Mates."
        />
      </section>
    </div>
  );
}

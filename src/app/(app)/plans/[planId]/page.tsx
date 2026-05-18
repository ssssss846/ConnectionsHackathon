import {
  addPlanParticipantAction,
  removePlanParticipantAction,
  savePlannerWorkspaceAction,
} from "@/app/actions";
import { PlannerWorkspace } from "@/components/planner-workspace";
import { getPlannerWorkspace } from "@/lib/data";

export default async function SharedPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ planId }, query] = await Promise.all([params, searchParams]);
  const workspace = await getPlannerWorkspace(planId);

  return (
    <div className="space-y-6">
      <PlannerWorkspace
        plan={workspace.plan}
        participants={workspace.participants}
        commonSubjects={workspace.commonSubjects}
        individualSubjects={workspace.individualSubjects}
        selectedChoices={workspace.selectedChoices}
        addableFriends={workspace.addableFriends}
        initialMessages={[
          ...(query.notice ? [{ tone: "success" as const, message: query.notice }] : []),
          ...(query.error ? [{ tone: "error" as const, message: query.error }] : []),
        ]}
        saveAction={savePlannerWorkspaceAction}
        addParticipantAction={addPlanParticipantAction}
        removeParticipantAction={removePlanParticipantAction}
      />
    </div>
  );
}

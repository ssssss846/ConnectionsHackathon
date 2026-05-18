import type { Term } from "@/lib/constants";

export type FormState = {
  error?: string;
  success?: string;
};

export type SubjectSelection = {
  code: string;
  name: string;
};

export type SubjectsByTerm = Record<Term, SubjectSelection[]>;

export type Viewer = {
  id: string;
  email?: string;
};

export type Profile = {
  id: string;
  username?: string;
  full_name: string;
  zid: string;
  unsw_email: string;
  created_at?: string;
};

export type SubjectRow = {
  id: string;
  user_id: string;
  term: Term;
  subject_code: string;
  subject_name: string;
};

export type FriendRequestRow = {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
  sender?: Profile;
  receiver?: Profile;
};

export type FriendshipRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at?: string;
};

export type SharedPlanRow = {
  id: string;
  owner_user_id: string;
  friend_user_id: string;
  term: Term;
  title: string;
  notes: string | null;
  created_at?: string;
};

export type SharedFriendMarker = {
  friendId: string;
  fullName: string;
  initials: string;
};

export type PlanParticipant = Profile & {
  is_owner?: boolean;
};

export type PlannerClassTime = {
  timeId: string;
  day: string;
  time: string;
  location: string;
  weeks: string;
  instructor?: string | null;
  startMinutes: number;
  endMinutes: number;
};

export type PlannerClassOption = {
  classId: string;
  classNumber: string;
  activity: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  times: PlannerClassTime[];
};

export type PlannerSubjectGroup = {
  subject: SubjectSelection;
  participants: PlanParticipant[];
  activityOptions: Array<{
    activity: string;
    options: PlannerClassOption[];
  }>;
};

export type PlannerChoice = {
  scopeType: "common" | "individual";
  participantUserId: string | null;
  subjectCode: string;
  activity: string;
  classId: string;
};

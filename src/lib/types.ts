import type { Interest, Term } from "@/lib/constants";

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
  degree: string | null;
  enrolled_year: number | null;
  enrolled_term: Term | null;
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
  friend_user_id: string | null;
  copied_from_plan_id?: string | null;
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

export type UserInterestRow = {
  user_id: string;
  interest: Interest;
};

export type TimetableSource = {
  id?: string;
  user_id: string;
  term: Term;
  source_type: "manual" | "calendar_url" | "auto_reference";
  calendar_url: string | null;
  notes: string | null;
  updated_at?: string;
};

export type TimetableBlock = {
  id?: string;
  user_id: string;
  term: Term;
  start_at?: string | null;
  end_at?: string | null;
  day_of_week: number;
  start_minutes: number;
  end_minutes: number;
  label: string;
  location: string | null;
  source_type: "manual" | "calendar_url" | "auto_reference";
};

export type FreeTimeSlot = {
  date?: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
};

export type RegisteredEvent = {
  id?: string;
  user_id: string;
  event_id: string;
  title: string;
  club_name: string | null;
  category: string | null;
  starts_at: string | null;
  ends_at: string | null;
  time_label: string | null;
  location: string | null;
  url: string | null;
  created_at?: string;
};

export type DegreeMutual = Profile & {
  mutual_friend_count: number;
};

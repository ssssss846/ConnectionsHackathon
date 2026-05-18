import { signOutAction } from "@/app/actions";

export async function POST() {
  await signOutAction();
}

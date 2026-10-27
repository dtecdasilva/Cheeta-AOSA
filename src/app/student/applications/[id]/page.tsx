import { redirect } from "next/navigation";

/** One application's status, history and decision. */
export default function Page() {
  redirect("/student/application/status");
}

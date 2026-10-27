import { redirect } from "next/navigation";

/** After submitting, the status page shows the Application ID and what happens next. */
export default function Page() {
  redirect("/student/application/status");
}

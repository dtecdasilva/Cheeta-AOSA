import { redirect } from "next/navigation";

/** The applicant's applications and where each stands live on the status page. */
export default function Page() {
  redirect("/student/application/status");
}

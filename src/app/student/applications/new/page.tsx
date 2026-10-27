import { redirect } from "next/navigation";

/** Applying to an institution starts by adding it. */
export default function Page() {
  redirect("/student/institutions/add");
}

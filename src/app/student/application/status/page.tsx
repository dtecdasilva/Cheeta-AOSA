import { Topbar } from "@/components/Topbar";
import MyApplicationStatus from "@/components/application/MyApplicationStatus";

export default function Page() {
  return (
    <>
      <Topbar title="Application Status" description="Track the status of each application and see its history." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <MyApplicationStatus />
      </main>
    </>
  );
}

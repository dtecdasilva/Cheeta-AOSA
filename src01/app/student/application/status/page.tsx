import { Topbar } from "@/components/Topbar";
import ApplicationStatus from "@/components/application/ApplicationStatus";
import { mockStatusHistory, mockRejectionReason, mockAdmissionInfo } from "@/lib/mockData/status";

export default function Page() {
  return (
    <>
      <Topbar title="Application Status" description="Track the status of your application and view its history." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ApplicationStatus history={mockStatusHistory} rejectionReason={mockRejectionReason} admission={mockAdmissionInfo.offer} />
      </main>
    </>
  );
}

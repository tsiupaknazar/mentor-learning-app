import { requireCurrentUser } from "@/lib/current-user";
import { InterviewPlaceholder } from "@/components/learning/interview-placeholder";

export default async function InterviewPage() {
  await requireCurrentUser();
  return <InterviewPlaceholder />;
}

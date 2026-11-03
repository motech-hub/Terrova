import { getCloudflareBindings } from "@/src/lib/cloudflare";

export async function startGenerationWorkflow(jobId: string) {
  const workflow = getCloudflareBindings().GENERATION_WORKFLOW;
  if (!workflow) return false;

  await workflow.create({ id: jobId, params: { jobId } });
  return true;
}

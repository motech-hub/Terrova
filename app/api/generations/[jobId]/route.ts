import { NextResponse } from "next/server";
import { finalizeGeneration, getGenerationJob } from "@/src/lib/generations/generation-store";
import { videoProvider } from "@/src/lib/video/openrouter-video-provider";
import { jobIdSchema } from "@/src/lib/validations/generation";
import { getUserIdForRequest } from "@/src/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const parsedJobId = jobIdSchema.parse(jobId);
    const stored = await getGenerationJob(parsedJobId);
    if (!stored) {
      return NextResponse.json({ error: "Génération introuvable." }, { status: 404 });
    }
    const sessionId = await getUserIdForRequest(undefined);
    if (!sessionId || stored.sessionId !== sessionId) {
      return NextResponse.json({ error: "Génération introuvable." }, { status: 404 });
    }
    const result = await videoProvider.getStatus(parsedJobId, {
      providerStatusUrl: stored.providerStatusUrl,
    });
    return NextResponse.json(await finalizeGeneration(parsedJobId, result));
  } catch {
    return NextResponse.json(
      { error: "Statut de génération indisponible." },
      { status: 400 },
    );
  }
}

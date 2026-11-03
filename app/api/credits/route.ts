import { NextResponse } from "next/server";
import { billingPlans, creditPacks } from "@/src/config/billing";
import { getCreditWallet } from "@/src/lib/credits/credit-store";
import { sessionIdSchema } from "@/src/lib/validations/credits";
import { getUserIdForRequest } from "@/src/lib/supabase/server";
import { hasPaydunyaConfig } from "@/src/lib/env";

export async function GET(request: Request) {
  const requestedSessionId = new URL(request.url).searchParams.get("sessionId");
  const sessionId = await getUserIdForRequest(requestedSessionId);
  const parsed = sessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const wallet = await getCreditWallet(parsed.data);
  return NextResponse.json({
    wallet,
    plans: billingPlans,
    packs: creditPacks,
    paymentsEnabled: hasPaydunyaConfig(),
  });
}

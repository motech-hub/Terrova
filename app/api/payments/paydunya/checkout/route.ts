import { NextResponse } from "next/server";
import { getPurchasableProduct } from "@/src/config/billing";
import { createPaydunyaInvoice, PaydunyaApiError } from "@/src/lib/payments/paydunya";
import {
  attachPaydunyaInvoice,
  createPaymentOrder,
  updatePaymentOrderStatus,
} from "@/src/lib/payments/payment-store";
import { getPaydunyaConfig } from "@/src/lib/env";
import { getCurrentUser, getUserIdForRequest } from "@/src/lib/supabase/server";
import { paymentProductSchema } from "@/src/lib/validations/credits";

function buildReturnUrl(returnTo: string | undefined) {
  const config = getPaydunyaConfig();
  if (!config || !returnTo) return undefined;
  const returnUrl = new URL(config.returnUrl);
  returnUrl.searchParams.set("next", returnTo);
  return returnUrl.toString();
}

export async function POST(request: Request) {
  if (!getPaydunyaConfig()) {
    return NextResponse.json({ error: "PayDunya n'est pas encore configuré." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La demande de paiement est invalide." }, { status: 400 });
  }

  const parsed = paymentProductSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Le produit demandé est invalide." }, { status: 400 });

  const sessionId = await getUserIdForRequest(parsed.data.sessionId);
  if (!sessionId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const product = getPurchasableProduct(parsed.data.productType, parsed.data.productId);
  if (!product) return NextResponse.json({ error: "Cette offre n'est pas disponible à l'achat." }, { status: 400 });

  const user = await getCurrentUser();
  const customerName = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : undefined;

  let orderId: string | undefined;
  try {
    const order = await createPaymentOrder(sessionId, product);
    orderId = order.orderId;
    const invoice = await createPaydunyaInvoice({
      orderId: order.orderId,
      product,
      customer: user?.email ? { name: customerName, email: user.email } : undefined,
      returnUrl: buildReturnUrl(parsed.data.returnTo),
    });
    await attachPaydunyaInvoice(order.orderId, invoice.token, invoice.checkoutUrl, product.priceXof);
    return NextResponse.json({
      orderId: order.orderId,
      checkoutUrl: invoice.checkoutUrl,
      status: "pending",
    });
  } catch (error) {
    const diagnostic = error instanceof PaydunyaApiError
      ? `PayDunya ${error.responseCode} (HTTP ${error.httpStatus})${error.responseText ? ` : ${error.responseText}` : ""}`
      : error instanceof Error
        ? error.message
        : "Erreur inconnue";
    if (error instanceof PaydunyaApiError) {
      console.error("[PayDunya] Échec de création de facture", {
        httpStatus: error.httpStatus,
        responseCode: error.responseCode,
        responseText: error.responseText,
      });
    } else {
      console.error("[PayDunya] Échec de création de facture", {
        message: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
    if (orderId) await updatePaymentOrderStatus(orderId, "failed").catch(() => undefined);
    return NextResponse.json({
      error: "Impossible de créer le paiement PayDunya pour le moment.",
      ...(process.env.NODE_ENV !== "production" ? { diagnostic } : {}),
    }, { status: 502 });
  }
}

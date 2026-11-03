import { NextResponse } from "next/server";
import {
  confirmPaydunyaInvoice,
  readPaydunyaPayment,
  verifyPaydunyaHash,
} from "@/src/lib/payments/paydunya";
import { reconcilePaydunyaPayment } from "@/src/lib/payments/payment-store";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Notification PayDunya invalide." }, { status: 400 });
  }
  const rawData = form.get("data");
  if (typeof rawData !== "string") {
    return NextResponse.json({ error: "Notification PayDunya invalide." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawData);
  } catch {
    return NextResponse.json({ error: "Notification PayDunya invalide." }, { status: 400 });
  }

  const callbackPayment = readPaydunyaPayment(payload);
  if (!callbackPayment || !(await verifyPaydunyaHash(callbackPayment.hash))) {
    return NextResponse.json({ error: "Signature PayDunya invalide." }, { status: 401 });
  }

  try {
    // Le callback déclenche la vérification officielle par token avant toute écriture métier.
    const confirmedPayment = await confirmPaydunyaInvoice(callbackPayment.token);
    await reconcilePaydunyaPayment(confirmedPayment);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "La notification PayDunya sera réessayée." }, { status: 502 });
  }
}

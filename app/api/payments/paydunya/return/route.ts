import { NextResponse } from "next/server";
import { confirmPaydunyaInvoice } from "@/src/lib/payments/paydunya";
import { reconcilePaydunyaPayment } from "@/src/lib/payments/payment-store";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || Array.from(value).some((character) => character.charCodeAt(0) < 32)) return "/pricing";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const destination = new URL(safeNextPath(requestUrl.searchParams.get("next")), requestUrl.origin);
  const token = requestUrl.searchParams.get("token");

  if (!token) {
    destination.searchParams.set("payment", "invalid");
    return NextResponse.redirect(destination);
  }

  try {
    const payment = await confirmPaydunyaInvoice(token);
    const order = await reconcilePaydunyaPayment(payment);
    destination.searchParams.set("payment", order?.status ?? payment.status);
  } catch {
    destination.searchParams.set("payment", "error");
  }

  return NextResponse.redirect(destination);
}

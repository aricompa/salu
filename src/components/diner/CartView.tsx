"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useOnline } from "@/components/ui/OfflineBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
import {
  cartStorageKey,
  cartTotals,
  removeItems,
  removeLine,
  setQuantity,
  soldOutMessage,
} from "@/lib/cart";
import { formatCents } from "@/lib/money";
import type { PlaceOrderResult } from "@/app/t/[token]/cart/actions";
import { useCart } from "./useCart";

/** Review and place the order (PRD D5). Prices here are for display; the database decides. */
export function CartView({
  token,
  sessionId,
  currency,
  placeOrder,
}: {
  token: string;
  sessionId: string;
  currency: string;
  placeOrder: (input: unknown) => Promise<PlaceOrderResult>;
}) {
  const [cart, updateCart] = useCart(cartStorageKey(token, sessionId));
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<{ message: string; closed?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const online = useOnline();
  const money = (cents: number) => formatCents(cents, currency);

  if (cart === null) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <p role="status" className="sr-only">
          Loading your order
        </p>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  const totals = cartTotals(cart);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col gap-4 py-12 text-center">
        {problem && (
          <p role="alert" className="text-danger">
            {problem.message}
          </p>
        )}
        <p className="text-lg text-muted">Your order is empty.</p>
        <Link href={`/t/${token}/menu`} className={buttonStyles("secondary", "self-center")}>
          Back to the menu
        </Link>
      </div>
    );
  }

  const submit = () =>
    startTransition(async () => {
      setProblem(null);
      const result = await placeOrder({
        lines: cart.map((l) => ({ itemId: l.itemId, quantity: l.quantity, notes: l.notes })),
        notes,
      });
      if (result.ok) {
        updateCart(() => []);
        router.push(`/t/${token}/orders/${result.data.orderId}`);
        return;
      }
      if (result.error.code === "item_unavailable" && result.soldOutItemIds?.length) {
        const gone = new Set(result.soldOutItemIds);
        const names = cart.filter((l) => gone.has(l.itemId)).map((l) => l.name);
        updateCart((c) => removeItems(c, gone));
        setProblem({ message: soldOutMessage(names) });
        return;
      }
      setProblem({
        message: result.error.message,
        closed: result.error.code === "session_closed" || result.error.code === "not_participant",
      });
    });

  return (
    <div className="flex flex-col gap-5 pb-40">
      <ul className="flex flex-col divide-y divide-border">
        {cart.map((line, index) => (
          <li key={`${line.itemId}-${line.notes}`} className="flex flex-col gap-2 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{line.name}</p>
                {line.notes && <p className="text-muted">“{line.notes}”</p>}
              </div>
              <p className="font-medium">{money(line.priceCents * line.quantity)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Stepper
                label="Quantity"
                context={line.name}
                value={line.quantity}
                onChange={(q) => updateCart((c) => setQuantity(c, index, q))}
              />
              <Button variant="ghost" onClick={() => updateCart((c) => removeLine(c, index))}>
                Remove <span className="sr-only">{line.name}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Textarea
        label="Notes for your order"
        hint="Optional, like allergies or timing."
        maxLength={500}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {problem && (
            <div role="alert" className="flex flex-col gap-2">
              <p className="text-danger">{problem.message}</p>
              {problem.closed && (
                <a href={`/t/${token}`} className={buttonStyles("secondary")}>
                  Scan again
                </a>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-lg">
            <span>Subtotal</span>
            <span className="font-semibold">{money(totals.subtotalCents)}</span>
          </div>
          <Button onClick={submit} loading={pending} disabled={!online} className="w-full">
            Place order
          </Button>
          <p className="text-center text-sm text-muted">
            {online
              ? "Sent straight to the kitchen."
              : "You're offline. Reconnect to place your order."}
          </p>
        </div>
      </div>
    </div>
  );
}

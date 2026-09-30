"use client";

import { useCallback, useSyncExternalStore } from "react";
import { loadCart, saveCart, type Cart } from "@/lib/cart";

type Store = { cart: Cart; listeners: Set<() => void> };
const stores = new Map<string, Store>();

function session(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined; // blocked storage: the cart still works for this page view
  }
}

function storeFor(key: string): Store {
  let store = stores.get(key);
  if (!store) {
    store = { cart: loadCart(session(), key), listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

/**
 * The cart for one table session, shared by the menu and cart pages. `null` until the
 * browser has read sessionStorage: the server can't know the cart, and "empty" would flash.
 */
export function useCart(key: string) {
  const cart = useSyncExternalStore(
    (onChange) => {
      const store = storeFor(key);
      store.listeners.add(onChange);
      return () => store.listeners.delete(onChange);
    },
    (): Cart | null => storeFor(key).cart,
    () => null,
  );
  const update = useCallback(
    (change: (cart: Cart) => Cart) => {
      const store = storeFor(key);
      store.cart = change(store.cart);
      saveCart(session(), key, store.cart);
      store.listeners.forEach((l) => l());
    },
    [key],
  );
  return [cart, update] as const;
}

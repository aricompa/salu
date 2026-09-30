"use client";

import { useCallback, useSyncExternalStore } from "react";
import { loadCart, saveCart, type Cart } from "@/lib/cart";

type Store = { cart: Cart; listeners: Set<() => void> };
const stores = new Map<string, Store>();
const EMPTY: Cart = [];

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

/** The cart for one table session, shared by the menu and cart pages. Server render: empty. */
export function useCart(key: string) {
  const cart = useSyncExternalStore(
    (onChange) => {
      const store = storeFor(key);
      store.listeners.add(onChange);
      return () => store.listeners.delete(onChange);
    },
    () => storeFor(key).cart,
    () => EMPTY,
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

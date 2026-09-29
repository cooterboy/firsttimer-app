// RevenueCat wrapper for the block-unlock purchases (spec/prototype.html's
// state.purchases / PRICE_ONE / PRICE_THREE). This app has no subscription and no
// entitlement to check. Block 1 is free; every later block is a non-consumable
// store product, and which products exist and what each unlocks lives in
// lib/blockCatalog.ts. Ownership is synced through Supabase's purchases table
// (lib/sync.ts's pushPurchase), same as every other record in this app (CLAUDE.md's
// sync rule: client-generated id, write local first, push when online,
// last-write-wins).
//
// RevenueCat's job here is strictly "process the payment and report which products
// this store account owns" — Supabase stays the single source of truth for what's
// unlocked. That's deliberate: treating RC entitlements as a second copy of
// ownership would mean reconciling two sources of truth, which is exactly the sync
// complexity CLAUDE.md says to avoid.
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import Purchases, { CustomerInfo, PURCHASES_ERROR_CODE, PurchasesError, PurchasesPackage } from "react-native-purchases";
import { BlockProduct, nextOffers, productFor, productLabel } from "./blockCatalog";
import { Purchase } from "./types";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const apiKey = Platform.OS === "ios" ? IOS_KEY : Platform.OS === "android" ? ANDROID_KEY : undefined;

export const isPurchasesConfigured = !!apiKey;

let configured = false;

export function configurePurchases() {
  if (configured || !apiKey) return;
  Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  configured = true;
}

// Ties the RevenueCat customer to the same id Supabase already uses, so "paid
// blocks stay yours on every device you sign in on" (the line PurchasesScreen.tsx
// already shows) is actually true for the purchase receipts, not just the synced
// Supabase rows. Call on sign-in; forgetPurchaser() on sign-out so a shared device
// can't attribute one account's purchase history to the next person who signs in.
export async function identifyPurchaser(userId: string) {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("RevenueCat logIn failed, staying anonymous:", e);
  }
}

export async function forgetPurchaser() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn("RevenueCat logOut failed:", e);
  }
}

export type BlockOffer = { product: BlockProduct; pkg: PurchasesPackage | null };

// The store packages for what someone owning blocks 1..owned can buy next: the
// next single block, and the bundle starting at that block if there is one. Every
// product has to be in RevenueCat's current Offering; a product missing from it
// comes back with pkg: null, and the Plans screen treats it as not buyable yet.
export async function getNextOffers(owned: number): Promise<{ single: BlockOffer | null; bundle: BlockOffer | null }> {
  const { single, bundle } = nextOffers(owned);
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const withPkg = (p: BlockProduct | null): BlockOffer | null =>
    p ? { product: p, pkg: pkgs.find((k) => k.product.identifier === p.id) ?? null } : null;
  return { single: withPkg(single), bundle: withPkg(bundle) };
}

// Buys one block product. Resolves once the store confirms it, with the purchase
// date the store recorded; the caller turns that into a Purchase record.
export async function buyBlockProduct(pkg: PurchasesPackage): Promise<{ productId: string; date: string }> {
  const { productIdentifier, transaction } = await Purchases.purchasePackage(pkg);
  return { productId: productIdentifier, date: transaction?.purchaseDate ?? new Date().toISOString() };
}

// Every block product this store account owns, according to the store. Used by
// Restore purchases; non-consumables are always reported, on any device signed
// into the same Apple ID / Google account.
export async function restoreBlockProducts(): Promise<{ productId: string; date: string }[]> {
  const customerInfo = await Purchases.restorePurchases();
  return ownedTransactions(customerInfo).map((t) => ({ productId: t.productIdentifier, date: t.purchaseDate }));
}

// One per catalog product, earliest purchase first — a non-consumable is owned
// once, but a store can list a re-download or a Family Sharing copy separately.
function ownedTransactions(customerInfo: CustomerInfo) {
  const seen = new Set<string>();
  return [...customerInfo.nonSubscriptionTransactions]
    .filter((t) => productFor(t.productIdentifier))
    .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
    .filter((t) => (seen.has(t.productIdentifier) ? false : (seen.add(t.productIdentifier), true)));
}

// The purchases table's id is a uuid, and a non-consumable is owned once per
// account, so the id is derived from (account, product): buying on one phone and
// restoring on another write the same row instead of two. Signed-out (no account
// yet) falls back to a random id, the same as every other client-created record.
export async function purchaseId(userId: string | null, productId: string): Promise<string> {
  if (!userId) return Crypto.randomUUID();
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `firsttimer-purchase:${userId}:${productId}`);
  // RFC 9562 layout, version 8 (application-defined), variant 10xx.
  const v = `8${hex.slice(13, 16)}`;
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${v}-${variant}-${hex.slice(20, 32)}`;
}

// The Purchase record for owning a product — the only shape Plans, Restore and the
// dev unlock all commit, so the three can't disagree.
export async function purchaseRecord(userId: string | null, product: BlockProduct, date: string): Promise<Purchase> {
  return {
    id: await purchaseId(userId, product.id),
    label: productLabel(product),
    price: product.price,
    blocks: product.blocks.length,
    productId: product.id,
    date,
  };
}

// The modern replacement for the deprecated PurchasesError.userCancelled boolean.
export function isUserCancelled(e: unknown): boolean {
  return (e as PurchasesError)?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

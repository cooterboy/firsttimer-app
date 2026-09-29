// RevenueCat wrapper for the block-unlock purchases (spec/prototype.html's
// state.purchases / PRICE_ONE / PRICE_THREE). This app has no subscription and no
// entitlement to check — Block 1 is free, every block after is a one-time
// non-renewing purchase, and ownership is a running count (lib/gymProgram.ts's
// ownedBlocks()) synced through Supabase's purchases table (lib/sync.ts's
// pushPurchase), same as every other record in this app (CLAUDE.md's sync rule:
// client-generated id, write local first, push when online, last-write-wins).
//
// RevenueCat's job here is strictly "process the payment and hand back a receipt" —
// Supabase stays the single source of truth for what's owned. That's deliberate:
// treating RC entitlements as a second copy of ownership would mean reconciling two
// sources of truth, which is exactly the sync complexity CLAUDE.md says to avoid.
import { Platform } from "react-native";
import Purchases, { CustomerInfo, PURCHASES_ERROR_CODE, PurchasesError, PurchasesPackage } from "react-native-purchases";

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const apiKey = Platform.OS === "ios" ? IOS_KEY : Platform.OS === "android" ? ANDROID_KEY : undefined;

export const isPurchasesConfigured = !!apiKey;

// Product identifiers — create these as Consumable IAPs in App Store Connect /
// Google Play Console with these exact identifiers, then add them to a RevenueCat
// Offering (see lib/purchases.ts doc comment below / the chat writeup for the full
// dashboard steps). Consumable, not non-consumable, because block ownership is
// unbounded (block 2, block 3, block 4, ...) — each purchase is its own transaction,
// and RevenueCat's receipt-based restore still recovers past ones (see
// restorePurchases() below), unlike raw StoreKit.
export const BLOCK_SINGLE_SKU = "block_single";
export const BLOCK_BUNDLE_THREE_SKU = "block_bundle_three";

// How many blocks each product grants — the only place this mapping lives, used by
// both the buy flow and restore-reconciliation so they can't drift from each other.
export const BLOCKS_GRANTED: Record<string, number> = {
  [BLOCK_SINGLE_SKU]: 1,
  [BLOCK_BUNDLE_THREE_SKU]: 3,
};

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

export async function getBlockPackages(): Promise<{
  single: PurchasesPackage | null;
  bundle: PurchasesPackage | null;
}> {
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return {
    single: pkgs.find((p) => p.product.identifier === BLOCK_SINGLE_SKU) ?? null,
    bundle: pkgs.find((p) => p.product.identifier === BLOCK_BUNDLE_THREE_SKU) ?? null,
  };
}

// Buys a package and hands back the specific transaction it created (by identifier,
// most recent first) — the caller uses its transactionIdentifier as the Purchase.id
// passed to appState.commitPurchase(), so a duplicated purchase-update event upserts
// onto the same Supabase row instead of double-crediting blocks.
export async function buyBlockPackage(pkg: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return latestTransactionFor(customerInfo, pkg.product.identifier);
}

// RevenueCat parses the full store receipt, so unlike raw StoreKit this recovers
// consumable purchases too — every block-purchase transaction tied to this Apple ID
// / Google account, not just ones still "unconsumed". Returns only the ones this
// app's product catalog recognizes, most recent first.
export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.nonSubscriptionTransactions
    .filter((t) => t.productIdentifier in BLOCKS_GRANTED)
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
}

function latestTransactionFor(customerInfo: CustomerInfo, productIdentifier: string) {
  return customerInfo.nonSubscriptionTransactions
    .filter((t) => t.productIdentifier === productIdentifier)
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
}

// The modern replacement for the deprecated PurchasesError.userCancelled boolean.
export function isUserCancelled(e: unknown): boolean {
  return (e as PurchasesError)?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

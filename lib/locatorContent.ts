// Ported from spec/prototype.html:3251-3266. These are real, working features — a
// Google Maps search opened for a query near a typed city/zip, no backend needed —
// not placeholders, unlike the box/gear content in lib/shopContent.ts.
export const GYM_KINDS = [
  { k: "gym", l: "Gyms", q: "gym" },
  { k: "climbing", l: "Climbing gyms", q: "climbing gym" },
  { k: "yoga", l: "Yoga", q: "yoga studio" },
  { k: "hyrox", l: "Hyrox / F45", q: "F45 training" },
  { k: "crossfit", l: "CrossFit", q: "crossfit" },
];

export const RECOVERY_KINDS = [
  { k: "physio", l: "Physical therapy", q: "physical therapist" },
  { k: "massage", l: "Sports massage", q: "sports massage" },
  { k: "chiro", l: "Chiropractic", q: "chiropractor" },
  { k: "stretch", l: "Stretch studio", q: "assisted stretching studio" },
  { k: "sauna", l: "Sauna", q: "sauna" },
  { k: "plunge", l: "Cold plunge", q: "cold plunge" },
  { k: "cryo", l: "Cryotherapy", q: "cryotherapy" },
];

export function mapSearchUrl(query: string, city: string): string {
  const q = query + (city ? ` near ${city}` : " near me");
  return "https://www.google.com/maps/search/" + encodeURIComponent(q);
}

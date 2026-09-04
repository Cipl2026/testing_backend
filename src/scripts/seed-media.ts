/** Stable Unsplash CDN URLs for dev/demo catalog seeding. */
const IMG = (id: string, w = 800, h = 600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const CATEGORY_MEDIA: Record<
  string,
  { image: string; description: string }
> = {
  plumbing: {
    image: IMG('photo-1585705270911-976438cc9f47'),
    description: 'Leaks, taps, pipes, and drainage fixes by verified plumbers.',
  },
  electrical: {
    image: IMG('photo-1621905251189-08b45d6a269e'),
    description: 'Safe wiring, switches, fans, and electrical inspections at home.',
  },
  'ac-services': {
    image: IMG('photo-1585771724684-38269c89aab8'),
    description: 'AC service, repair, gas refill, and installation by trained technicians.',
  },
  cleaning: {
    image: IMG('photo-1581578731548-c64695cc6952'),
    description: 'Deep cleaning for bathroom, kitchen, and full home sanitization.',
  },
  'appliance-repair': {
    image: IMG('photo-1556909114-f6e7ad7d4046'),
    description: 'Repair for washing machines, fridges, microwaves, and geysers.',
  },
  carpentry: {
    image: IMG('photo-1504917595217-d4dc5ebe6122'),
    description: 'Furniture repair, door fixes, and custom carpentry work.',
  },
  painting: {
    image: IMG('photo-1562259949-e8e7689d7828'),
    description: 'Interior painting, touch-ups, and on-site colour consultation.',
  },
  'pest-control': {
    image: IMG('photo-1621509950598-c337ee6eec38'),
    description: 'Cockroach, termite, and mosquito treatments with safe chemicals.',
  },
};

export const SERVICE_MEDIA: Record<string, string> = {
  'tap-repair': IMG('photo-1607472586893-edb57bdc0e39'),
  'pipe-leakage-repair': IMG('photo-1607472586893-edb57bdc0e39'),
  'sink-leakage-repair': IMG('photo-1556911220-bff31c812dba'),
  'drainage-blockage': IMG('photo-1584622781864-374516a00647'),
  'switch-and-socket-repair': IMG('photo-1473341304170-971dccb5ac1e'),
  'light-installation': IMG('photo-1513506003901-1e6a229e2d15'),
  'fan-repair': IMG('photo-1558618666-fcd25c85cd64'),
  'basic-electrical-inspection': IMG('photo-1621905252507-b35492cc74b4'),
  'split-ac-service': IMG('photo-1631545806609-9fdeb4e1f04a'),
  'window-ac-service': IMG('photo-1631545806609-9fdeb4e1f04a'),
  'ac-cooling-repair': IMG('photo-1585771724684-38269c89aab8'),
  'ac-installation': IMG('photo-1631545806609-9fdeb4e1f04a'),
  'bathroom-cleaning': IMG('photo-1620626011761-996317b8d101'),
  'kitchen-deep-cleaning': IMG('photo-1556911220-e15b29be8c8f'),
  'home-deep-cleaning': IMG('photo-1581578731548-c64695cc6952'),
  'washing-machine-repair': IMG('photo-1626806787464-57c685026aa2'),
  'refrigerator-repair': IMG('photo-1571175443880-fa41fb1a4f12'),
  'microwave-repair': IMG('photo-1585659728313-4f882a47d7dc'),
  'geyser-repair': IMG('photo-1620626011761-996317b8d101'),
  'furniture-repair': IMG('photo-1555041469-a586c61ea9bc'),
  'door-repair': IMG('photo-1497366216548-37526070297c'),
  'curtain-rod-installation': IMG('photo-1615529328331-f8917597711f'),
  'wall-painting-consultation': IMG('photo-1562259949-e8e7689d7828'),
  'interior-painting': IMG('photo-1562259949-e8e7689d7828'),
  'touch-up-painting': IMG('photo-1589939705382-41e64a40b4c7'),
  'cockroach-treatment': IMG('photo-1621509950598-c337ee6eec38'),
  'termite-inspection': IMG('photo-1530836369250-59b4a4b1eafa'),
  'mosquito-treatment': IMG('photo-1474511320723-9a8c9f4d97de'),
};

export const PROVIDER_AVATARS: Record<string, string> = {
  '9876543211': IMG('photo-1560250097-0b93528c311a', 400, 400),
  '9876543212': IMG('photo-1519085360753-af0119f7cbe7', 400, 400),
  '9876543213': IMG('photo-1507003211169-0a1dd7228f2d', 400, 400),
};

export const CUSTOMER_AVATAR = IMG('photo-1535713875002-d1d0cf377fde', 400, 400);

const BANNER = (id: string) => IMG(id, 600, 600);

/** Square accent images for home carousel (shown as thumbnail, not full bleed). */
export const HOME_BANNER_MEDIA = {
  trustedPros: BANNER('photo-1581578731548-c64695cc6952'),
  urgentFix: BANNER('photo-1607472586893-edb57bdc0e39'),
  summerAc: BANNER('photo-1631545806609-9fdeb4e1f04a'),
  festiveOffer: BANNER('photo-1562259949-e8e7689d7828'),
} as const;

/** Card images for picked / recommended carousels. */
export const HOME_CARD_MEDIA = {
  deepClean: IMG('photo-1581578731548-c64695cc6952', 900, 600),
  acCare: IMG('photo-1631545806609-9fdeb4e1f04a', 900, 600),
  plumbing: IMG('photo-1585705270911-976438cc9f47', 900, 600),
  electrical: IMG('photo-1621905251189-08b45d6a269e', 900, 600),
} as const;

export function categoryImage(slug: string): string | undefined {
  return CATEGORY_MEDIA[slug]?.image;
}

export function categoryDescription(slug: string): string | undefined {
  return CATEGORY_MEDIA[slug]?.description;
}

export function serviceImage(slug: string, categorySlug: string): string {
  return SERVICE_MEDIA[slug] ?? CATEGORY_MEDIA[categorySlug]?.image ?? IMG('photo-1581578731548-c64695cc6952');
}

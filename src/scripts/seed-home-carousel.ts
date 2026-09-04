import {
  HomeCarouselActionType,
  HomeCarouselItem,
  HomeCarouselPlacement,
} from '@/models/HomeCarouselItem.js';
import { Category } from '@/models/Category.js';
import { Service } from '@/models/Service.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { HOME_BANNER_MEDIA, HOME_CARD_MEDIA } from '@/scripts/seed-media.js';
import { logger } from '@/utils/logger.js';

type CarouselSeed = {
  placement: HomeCarouselPlacement;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionType: HomeCarouselActionType;
  actionValue?: string;
  displayOrder: number;
};

async function upsertCarouselItem(seed: CarouselSeed) {
  await HomeCarouselItem.findOneAndUpdate(
    { placement: seed.placement, title: seed.title },
    {
      $set: {
        ...seed,
        isActive: true,
        validFrom: null,
        validTo: null,
      },
    },
    { upsert: true, new: true },
  );
}

export async function seedHomeCarousel(): Promise<void> {
  const [categories, urgentService, featuredServices] = await Promise.all([
    Category.find({ isActive: true }).sort({ displayOrder: 1 }).limit(4).lean(),
    Service.findOne({ isActive: true, isUrgentAvailable: true }).sort({ displayOrder: 1 }).lean(),
    Service.find({ isActive: true, isFeatured: true }).sort({ displayOrder: 1 }).limit(4).lean(),
  ]);

  const plumbingCategory = categories.find((c) => c.slug === 'plumbing') ?? categories[0];
  const acCategory = categories.find((c) => c.slug === 'ac-services') ?? categories[1];
  const cleaningCategory = categories.find((c) => c.slug === 'cleaning') ?? categories[2];

  const banners: CarouselSeed[] = [
    {
      placement: HomeCarouselPlacement.BANNER,
      title: 'Trusted pros at your doorstep',
      subtitle: 'Book verified electricians, plumbers, cleaners & more',
      imageUrl: HOME_BANNER_MEDIA.trustedPros,
      actionType: HomeCarouselActionType.ROUTE,
      actionValue: '/(tabs)/services',
      displayOrder: 0,
    },
    {
      placement: HomeCarouselPlacement.BANNER,
      title: 'Beat the summer heat',
      subtitle: 'AC service, gas refill & cooling repair from ₹299',
      imageUrl: HOME_BANNER_MEDIA.summerAc,
      actionType: acCategory
        ? HomeCarouselActionType.CATEGORY
        : HomeCarouselActionType.ROUTE,
      actionValue: acCategory ? acCategory._id.toString() : '/(tabs)/services',
      displayOrder: 1,
    },
    {
      placement: HomeCarouselPlacement.BANNER,
      title: 'Save 20% on your first booking',
      subtitle: 'Use code GHAAR20 on orders above ₹499',
      imageUrl: HOME_BANNER_MEDIA.festiveOffer,
      actionType: HomeCarouselActionType.ROUTE,
      actionValue: '/(tabs)/services',
      displayOrder: 2,
    },
  ];

  const urgentFix: CarouselSeed = {
    placement: HomeCarouselPlacement.URGENT_FIX,
    title: 'Need help right now?',
    subtitle: 'Get an urgent fix in minutes — we search nearby pros for you',
    imageUrl: HOME_BANNER_MEDIA.urgentFix,
    actionType: HomeCarouselActionType.ROUTE,
    actionValue: '/urgent/request',
    displayOrder: 0,
  };

  await HomeCarouselItem.updateMany(
    { placement: HomeCarouselPlacement.BANNER, title: urgentFix.title },
    { $set: { isActive: false } },
  );

  const pickedForYou: CarouselSeed[] = [
    {
      placement: HomeCarouselPlacement.PICKED_FOR_YOU,
      title: 'Deep home cleaning',
      subtitle: 'Kitchen, bathroom & full-home packages',
      imageUrl: HOME_CARD_MEDIA.deepClean,
      actionType: cleaningCategory
        ? HomeCarouselActionType.CATEGORY
        : HomeCarouselActionType.ROUTE,
      actionValue: cleaningCategory ? cleaningCategory._id.toString() : '/(tabs)/services',
      displayOrder: 0,
    },
    {
      placement: HomeCarouselPlacement.PICKED_FOR_YOU,
      title: 'AC care plan',
      subtitle: 'Seasonal service to keep cooling efficient',
      imageUrl: HOME_CARD_MEDIA.acCare,
      actionType: acCategory ? HomeCarouselActionType.CATEGORY : HomeCarouselActionType.ROUTE,
      actionValue: acCategory ? acCategory._id.toString() : '/(tabs)/services',
      displayOrder: 1,
    },
  ];

  const recommendedForYou: CarouselSeed[] = featuredServices.slice(0, 3).map((service, index) => ({
    placement: HomeCarouselPlacement.RECOMMENDED_FOR_YOU,
    title: service.name,
    subtitle: service.shortDescription ?? 'Popular with customers near you',
    imageUrl: service.image || HOME_CARD_MEDIA.plumbing,
    actionType: HomeCarouselActionType.SERVICE,
    actionValue: service._id.toString(),
    displayOrder: index,
  }));

  if (recommendedForYou.length === 0 && urgentService) {
    recommendedForYou.push({
      placement: HomeCarouselPlacement.RECOMMENDED_FOR_YOU,
      title: urgentService.name,
      subtitle: urgentService.shortDescription ?? 'Available for urgent booking',
      imageUrl: urgentService.image || HOME_CARD_MEDIA.plumbing,
      actionType: HomeCarouselActionType.SERVICE,
      actionValue: urgentService._id.toString(),
      displayOrder: 0,
    });
  }

  if (recommendedForYou.length === 0 && plumbingCategory) {
    recommendedForYou.push({
      placement: HomeCarouselPlacement.RECOMMENDED_FOR_YOU,
      title: 'Plumbing services',
      subtitle: 'Leaks, taps, and drainage fixes',
      imageUrl: HOME_CARD_MEDIA.plumbing,
      actionType: HomeCarouselActionType.CATEGORY,
      actionValue: plumbingCategory._id.toString(),
      displayOrder: 0,
    });
  }

  const allItems = [...banners, urgentFix, ...pickedForYou, ...recommendedForYou];
  for (const item of allItems) {
    await upsertCarouselItem(item);
  }

  logger.info('Home carousel seeded', {
    banners: banners.length,
    urgentFix: 1,
    pickedForYou: pickedForYou.length,
    recommendedForYou: recommendedForYou.length,
  });
}

async function main() {
  if (env.isProd) {
    throw new Error('Home carousel seed cannot run in production.');
  }
  await connectDatabase();
  await seedHomeCarousel();
  await disconnectDatabase();
}

if (
  process.argv[1]?.endsWith('seed-home-carousel.ts') ||
  process.argv[1]?.endsWith('seed-home-carousel.js')
) {
  main().catch(async (error) => {
    console.error('Home carousel seed failed:', error);
    await disconnectDatabase();
    process.exit(1);
  });
}

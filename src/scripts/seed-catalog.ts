import { PricingType } from '@ghaarfix/shared-types';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { Category } from '@/models/Category.js';
import { Service } from '@/models/Service.js';
import { Subcategory } from '@/models/Subcategory.js';
import {
  categoryDescription,
  categoryImage,
  serviceImage,
} from '@/scripts/seed-media.js';
import { slugify } from '@/utils/catalog.js';
import { logger } from '@/utils/logger.js';

type SeedService = {
  name: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  minMinutes: number;
  maxMinutes: number;
  urgent?: boolean;
  whatIsIncluded?: string[];
  whatIsNotIncluded?: string[];
  faqs?: { question: string; answer: string }[];
  warranty?: { days: number; description: string };
};

type SeedSubcategory = {
  name: string;
  description?: string;
  services: SeedService[];
};

type SeedCategory = {
  name: string;
  icon: string;
  subcategories: SeedSubcategory[];
};

const DEFAULT_INCLUDED = ['Professional inspection', 'Basic labour', 'Post-service cleanup'];
const DEFAULT_EXCLUDED = ['Replacement parts', 'Major component upgrades', 'Permit fees'];

const CATALOG: SeedCategory[] = [
  {
    name: 'Plumbing',
    icon: 'water-outline',
    subcategories: [
      {
        name: 'Bathroom Plumbing',
        description: 'Taps, showers, and bathroom pipe work',
        services: [
          {
            name: 'Tap Repair',
            shortDescription: 'Fix leaking or broken taps',
            description:
              'Our plumber diagnoses worn washers, cartridges, and loose fittings to stop leaks and restore smooth water flow in bathroom taps.',
            startingPrice: 199,
            minMinutes: 30,
            maxMinutes: 60,
            urgent: true,
            whatIsIncluded: ['Leak diagnosis', 'Washer or cartridge replacement', 'Flow test'],
            faqs: [
              { question: 'Do I need to buy spare parts?', answer: 'Basic washers are included. Premium parts are charged separately.' },
            ],
          },
          {
            name: 'Pipe Leakage Repair',
            shortDescription: 'Stop hidden pipe leaks',
            description:
              'Locate and seal pipe leaks behind walls or under fixtures before they cause water damage or mould.',
            startingPrice: 299,
            minMinutes: 45,
            maxMinutes: 90,
            urgent: true,
            warranty: { days: 15, description: 'Leak re-occurrence covered for 15 days on the repaired joint.' },
          },
        ],
      },
      {
        name: 'Kitchen Plumbing',
        description: 'Sink, drainage, and kitchen water lines',
        services: [
          {
            name: 'Sink Leakage Repair',
            shortDescription: 'Repair kitchen sink leaks',
            description: 'Fix leaks at the sink base, P-trap, or supply lines with proper sealing.',
            startingPrice: 249,
            minMinutes: 30,
            maxMinutes: 75,
          },
          {
            name: 'Drainage Blockage',
            shortDescription: 'Clear blocked drains',
            description: 'Mechanical and jet cleaning to clear grease, food waste, and hair blockages.',
            startingPrice: 349,
            minMinutes: 45,
            maxMinutes: 90,
            urgent: true,
          },
        ],
      },
    ],
  },
  {
    name: 'Electrical',
    icon: 'flash-outline',
    subcategories: [
      {
        name: 'Switch & Socket',
        services: [
          {
            name: 'Switch and Socket Repair',
            shortDescription: 'Fix faulty switches and sockets',
            description: 'Safe repair or replacement of damaged switches and power sockets.',
            startingPrice: 149,
            minMinutes: 30,
            maxMinutes: 60,
          },
          {
            name: 'Light Installation',
            shortDescription: 'Install ceiling and wall lights',
            description: 'Mount and wire ceiling lights, chandeliers, and wall fixtures.',
            startingPrice: 199,
            minMinutes: 45,
            maxMinutes: 90,
          },
        ],
      },
      {
        name: 'Fan',
        services: [
          {
            name: 'Fan Repair',
            shortDescription: 'Repair ceiling and exhaust fans',
            description: 'Fix wobbling, noise, or motor issues in ceiling and exhaust fans.',
            startingPrice: 179,
            minMinutes: 30,
            maxMinutes: 75,
            urgent: true,
          },
          {
            name: 'Basic Electrical Inspection',
            shortDescription: 'Safety inspection for home wiring',
            description: 'Visual inspection of panels, earthing, and load points with a safety report.',
            startingPrice: 299,
            minMinutes: 45,
            maxMinutes: 60,
          },
        ],
      },
    ],
  },
  {
    name: 'AC Services',
    icon: 'snow-outline',
    subcategories: [
      {
        name: 'AC Service',
        services: [
          {
            name: 'Split AC Service',
            shortDescription: 'Deep cleaning and gas check',
            description: 'Filter cleaning, coil wash, drain flush, and cooling performance check.',
            startingPrice: 499,
            minMinutes: 60,
            maxMinutes: 120,
            whatIsIncluded: ['Indoor unit cleaning', 'Outdoor unit wash', 'Cooling test'],
          },
          {
            name: 'Window AC Service',
            shortDescription: 'Service for window AC units',
            description: 'Complete service for window AC units including filter and coil cleaning.',
            startingPrice: 399,
            minMinutes: 45,
            maxMinutes: 90,
          },
        ],
      },
      {
        name: 'AC Repair',
        services: [
          {
            name: 'AC Cooling Repair',
            shortDescription: 'Fix cooling performance issues',
            description: 'Diagnose refrigerant, compressor, and airflow issues affecting cooling.',
            startingPrice: 599,
            minMinutes: 60,
            maxMinutes: 150,
            urgent: true,
          },
          {
            name: 'AC Installation',
            shortDescription: 'Professional AC installation',
            description: 'Wall mounting, piping, vacuuming, and commissioning of split AC units.',
            startingPrice: 999,
            minMinutes: 120,
            maxMinutes: 240,
          },
        ],
      },
    ],
  },
  {
    name: 'Cleaning',
    icon: 'sparkles-outline',
    subcategories: [
      {
        name: 'Home Cleaning',
        services: [
          {
            name: 'Bathroom Cleaning',
            shortDescription: 'Deep bathroom sanitization',
            description: 'Descale tiles, sanitize fixtures, and polish mirrors and fittings.',
            startingPrice: 399,
            minMinutes: 60,
            maxMinutes: 120,
          },
          {
            name: 'Kitchen Deep Cleaning',
            shortDescription: 'Degrease and sanitize kitchen',
            description: 'Degrease chimney, countertops, cabinets, and floor with food-safe products.',
            startingPrice: 599,
            minMinutes: 90,
            maxMinutes: 180,
          },
          {
            name: 'Home Deep Cleaning',
            shortDescription: 'Full home deep cleaning',
            description: 'End-to-end deep cleaning for living areas, bedrooms, kitchen, and bathrooms.',
            startingPrice: 1499,
            minMinutes: 180,
            maxMinutes: 360,
          },
        ],
      },
    ],
  },
  {
    name: 'Appliance Repair',
    icon: 'construct-outline',
    subcategories: [
      {
        name: 'Home Appliances',
        services: [
          {
            name: 'Washing Machine Repair',
            shortDescription: 'Fix washing machine issues',
            description: 'Repair drum, motor, inlet valve, and drainage problems.',
            startingPrice: 399,
            minMinutes: 45,
            maxMinutes: 120,
          },
          {
            name: 'Refrigerator Repair',
            shortDescription: 'Cooling and compressor repairs',
            description: 'Fix cooling loss, thermostat faults, and compressor-related issues.',
            startingPrice: 449,
            minMinutes: 60,
            maxMinutes: 150,
          },
          {
            name: 'Microwave Repair',
            shortDescription: 'Microwave heating repairs',
            description: 'Diagnose magnetron, door switch, and control panel faults.',
            startingPrice: 299,
            minMinutes: 30,
            maxMinutes: 90,
          },
          {
            name: 'Geyser Repair',
            shortDescription: 'Water heater repair service',
            description: 'Fix heating element, thermostat, and leakage in electric geysers.',
            startingPrice: 349,
            minMinutes: 45,
            maxMinutes: 90,
            urgent: true,
          },
        ],
      },
    ],
  },
  {
    name: 'Carpentry',
    icon: 'hammer-outline',
    subcategories: [
      {
        name: 'Furniture & Doors',
        services: [
          {
            name: 'Furniture Repair',
            shortDescription: 'Repair chairs, tables and cabinets',
            description: 'Fix hinges, joints, drawers, and structural damage in wooden furniture.',
            startingPrice: 299,
            minMinutes: 60,
            maxMinutes: 180,
          },
          {
            name: 'Door Repair',
            shortDescription: 'Fix hinges, locks and alignment',
            description: 'Align doors, replace hinges, and fix latch and lock issues.',
            startingPrice: 249,
            minMinutes: 45,
            maxMinutes: 120,
          },
          {
            name: 'Curtain Rod Installation',
            shortDescription: 'Install curtain rods and fittings',
            description: 'Measure, drill, and mount curtain rods on concrete or wooden walls.',
            startingPrice: 199,
            minMinutes: 30,
            maxMinutes: 60,
          },
        ],
      },
    ],
  },
  {
    name: 'Painting',
    icon: 'color-palette-outline',
    subcategories: [
      {
        name: 'Interior Painting',
        services: [
          {
            name: 'Wall Painting Consultation',
            shortDescription: 'On-site paint consultation',
            description: 'Colour palette advice, surface assessment, and material estimate.',
            startingPrice: 199,
            minMinutes: 30,
            maxMinutes: 60,
          },
          {
            name: 'Interior Painting',
            shortDescription: 'Professional interior painting',
            description: 'Surface prep, putty, primer, and two-coat emulsion painting.',
            startingPrice: 1999,
            minMinutes: 240,
            maxMinutes: 480,
          },
          {
            name: 'Touch-up Painting',
            shortDescription: 'Small area paint touch-ups',
            description: 'Patch and repaint small wall sections after repairs or installations.',
            startingPrice: 499,
            minMinutes: 60,
            maxMinutes: 180,
          },
        ],
      },
    ],
  },
  {
    name: 'Pest Control',
    icon: 'bug-outline',
    subcategories: [
      {
        name: 'Treatment',
        services: [
          {
            name: 'Cockroach Treatment',
            shortDescription: 'Safe cockroach treatment',
            description: 'Gel and spray treatment for kitchens and bathrooms with follow-up guidance.',
            startingPrice: 699,
            minMinutes: 60,
            maxMinutes: 120,
            warranty: { days: 30, description: 'Free revisit if infestation returns within 30 days.' },
          },
          {
            name: 'Termite Inspection',
            shortDescription: 'Termite inspection and report',
            description: 'Moisture and wood damage inspection with a written assessment.',
            startingPrice: 499,
            minMinutes: 45,
            maxMinutes: 90,
          },
          {
            name: 'Mosquito Treatment',
            shortDescription: 'Mosquito control treatment',
            description: 'Fogging and breeding-site treatment for indoor and outdoor areas.',
            startingPrice: 599,
            minMinutes: 45,
            maxMinutes: 90,
          },
        ],
      },
    ],
  },
];

async function seedCatalog() {
  let order = 1;
  for (const categorySeed of CATALOG) {
    const categorySlug = slugify(categorySeed.name);
    const category = await Category.findOneAndUpdate(
      { slug: categorySlug },
      {
        $set: {
          name: categorySeed.name,
          slug: categorySlug,
          icon: categorySeed.icon,
          description: categoryDescription(categorySlug),
          image: categoryImage(categorySlug),
          isActive: true,
          displayOrder: order,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    order += 1;

    let subOrder = 1;
    for (const subSeed of categorySeed.subcategories) {
      const subSlug = slugify(subSeed.name);
      const subcategory = await Subcategory.findOneAndUpdate(
        { categoryId: category._id, slug: subSlug },
        {
          $set: {
            categoryId: category._id,
            name: subSeed.name,
            slug: subSlug,
            description: subSeed.description,
            image: categoryImage(categorySlug),
            isActive: true,
            displayOrder: subOrder,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      subOrder += 1;

      let serviceOrder = 1;
      for (const serviceSeed of subSeed.services) {
        const serviceSlug = slugify(serviceSeed.name);
        const urgentFields = {
          isUrgentAvailable: true,
          urgentConfig: {
            enabled: true,
            baseFee: 99,
            extraFee: 50,
            responseTimeoutMinutes: 5,
            maxProviderDistanceKm: 15,
            maxBroadcastProviders: 10,
          },
        };

        await Service.findOneAndUpdate(
          { slug: serviceSlug },
          {
            $set: {
              categoryId: category._id,
              subcategoryId: subcategory._id,
              name: serviceSeed.name,
              slug: serviceSlug,
              shortDescription: serviceSeed.shortDescription,
              description: serviceSeed.description,
              image: serviceImage(serviceSlug, categorySlug),
              pricing: {
                type: PricingType.STARTING_FROM,
                startingPrice: serviceSeed.startingPrice,
                currency: 'INR',
              },
              estimatedDuration: {
                minMinutes: serviceSeed.minMinutes,
                maxMinutes: serviceSeed.maxMinutes,
              },
              whatIsIncluded: serviceSeed.whatIsIncluded ?? DEFAULT_INCLUDED,
              whatIsNotIncluded: serviceSeed.whatIsNotIncluded ?? DEFAULT_EXCLUDED,
              faqs: serviceSeed.faqs ?? [],
              warranty: serviceSeed.warranty,
              isActive: true,
              isFeatured: serviceOrder <= 2,
              displayOrder: serviceOrder,
              ...urgentFields,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        serviceOrder += 1;
      }
    }
  }

  await Service.updateMany(
    { isActive: true },
    {
      $set: {
        isUrgentAvailable: true,
        'urgentConfig.enabled': true,
        'urgentConfig.baseFee': 99,
        'urgentConfig.extraFee': 50,
        'urgentConfig.responseTimeoutMinutes': 5,
        'urgentConfig.maxProviderDistanceKm': 15,
        'urgentConfig.maxBroadcastProviders': 10,
      },
    },
  );

  logger.info('Catalog seed completed successfully (with images and descriptions).');
}

export { seedCatalog };

async function main() {
  if (env.isProd) {
    throw new Error('Catalog seed cannot run in production.');
  }
  await connectDatabase();
  await seedCatalog();
  await disconnectDatabase();
}

if (process.argv[1]?.includes('seed-catalog')) {
  main().catch(async (error) => {
    console.error('Catalog seed failed:', error);
    await disconnectDatabase();
    process.exit(1);
  });
}

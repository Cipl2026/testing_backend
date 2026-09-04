import { Booking } from '@/models/Booking.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import { Service } from '@/models/Service.js';

export interface DataQualityReport {
  generatedAt: string;
  datasets: Array<{
    name: string;
    source: string;
    recordCount: number;
    issues: string[];
    privacyClassification: 'PUBLIC' | 'INTERNAL' | 'PII' | 'SENSITIVE';
  }>;
  summary: {
    totalIssues: number;
    readyForRules: boolean;
    readyForML: boolean;
  };
}

export async function generateDataReadinessReport(): Promise<DataQualityReport> {
  const [
    bookingCount,
    completedCount,
    cancelledWithoutReason,
    assetsWithoutType,
    servicesInactive,
    bookingsWithInvalidAmount,
  ] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'COMPLETED' }),
    Booking.countDocuments({
      status: 'CANCELLED',
      $or: [{ 'cancellation.reason': { $exists: false } }, { 'cancellation.reason': '' }],
    }),
    HomeAsset.countDocuments({ assetTypeId: { $exists: false } }),
    Service.countDocuments({ isActive: false }),
    Booking.countDocuments({ 'price.finalAmount': { $lt: 0 } }),
  ]);

  const completionRate = bookingCount > 0 ? completedCount / bookingCount : 0;

  const datasets = [
    {
      name: 'bookings',
      source: 'Booking collection',
      recordCount: bookingCount,
      issues: [
        ...(cancelledWithoutReason > 0
          ? [`${cancelledWithoutReason} cancellations missing reason`]
          : []),
        ...(bookingsWithInvalidAmount > 0
          ? [`${bookingsWithInvalidAmount} bookings with invalid amounts`]
          : []),
      ],
      privacyClassification: 'PII' as const,
    },
    {
      name: 'home_assets',
      source: 'HomeAsset collection',
      recordCount: await HomeAsset.countDocuments(),
      issues: assetsWithoutType > 0 ? [`${assetsWithoutType} assets missing type`] : [],
      privacyClassification: 'INTERNAL' as const,
    },
    {
      name: 'services',
      source: 'Service catalog',
      recordCount: await Service.countDocuments(),
      issues: servicesInactive > 0 ? [`${servicesInactive} inactive services`] : [],
      privacyClassification: 'PUBLIC' as const,
    },
  ];

  const totalIssues = datasets.reduce((sum, d) => sum + d.issues.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    datasets,
    summary: {
      totalIssues,
      readyForRules: bookingCount >= 10,
      readyForML: bookingCount >= 500 && completionRate > 0.5 && totalIssues < 5,
    },
  };
}

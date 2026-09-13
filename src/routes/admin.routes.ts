import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as appVersionAdminController from '@/modules/app-updates/app-version-admin.controller.js';
import * as adminController from '@/modules/auth/admin.controller.js';
import * as userAdminController from '@/modules/users/user-admin.controller.js';
import * as platformAdminController from '@/modules/platform/admin-platform.controller.js';
import * as catalogAdminController from '@/modules/services/catalog-admin.controller.js';
import * as uploadAdminController from '@/modules/storage/upload-admin.controller.js';
import { uploadMiddleware } from '@/middleware/upload.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '@/middleware/validate.js';
import { adminLoginSchema } from '@/validators/auth.js';
import {
  adminListQuerySchema,
  categoryBodySchema,
  categoryCreateBodySchema,
  objectIdParamSchema,
  rejectProviderServiceSchema,
  serviceBodySchema,
  serviceCreateBodySchema,
  serviceListQuerySchema,
  subcategoryBodySchema,
  subcategoryCreateBodySchema,
} from '@/validators/catalog.js';
import { providerIdParamSchema } from '@/validators/availability.js';
import * as adminAvailabilityController from '@/modules/provider-availability/admin-availability.controller.js';
import * as bookingController from '@/modules/bookings/booking.controller.js';
import {
  bookingIdParamSchema,
  adminBookingListQuerySchema,
} from '@/validators/booking.js';
import {
  adminUrgentListQuerySchema,
  cancelUrgentBodySchema,
  urgentRequestIdParamSchema,
} from '@/validators/urgent.js';
import {
  homeHelpDurationPackageBodySchema,
  homeHelpDurationPackageUpdateSchema,
  homeHelpCompatibilityConfigBodySchema,
  homeHelpPackageIdParamSchema,
} from '@/validators/home-help-admin.js';
import {
  adminRecurringPlanListQuerySchema,
  adminUpdateRecurringPlanBodySchema,
  recurringPlanIdParamSchema,
} from '@/validators/home-help-recurring.js';
import * as urgentAdminController from '@/modules/urgent/urgent-admin.controller.js';
import * as homeHelpAdminController from '@/modules/home-help/home-help-admin.controller.js';
import * as recurringController from '@/modules/home-help/home-help-recurring.controller.js';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';
import * as homeHealthController from '@/modules/home-health/home-health.controller.js';
import {
  adminListReviewsQuerySchema,
  adminListTicketsQuerySchema,
  adminTicketUpdateBodySchema,
  reviewIdParamSchema,
  reviewModerationBodySchema,
  ticketIdParamSchema,
} from '@/validators/post-service.js';
import {
  adminCustomersListQuerySchema,
  adminProvidersListQuerySchema,
  adminProviderIdParamSchema,
  adminUpdateCustomerStatusBodySchema,
  adminUpdateProviderStatusBodySchema,
  adminUserIdParamSchema,
} from '@/validators/user-admin.js';
import { sendPlatformNotificationBodySchema, sendTestPlatformNotificationBodySchema } from '@/validators/platform-broadcast.js';
import { z } from 'zod';
import { paginationQuerySchema } from '@ghaarfix/validation';
import { assetTypeBodySchema, maintenanceTemplateBodySchema } from '@/validators/home-health.js';
import * as providerQualityController from '@/modules/provider-quality/provider-quality.controller.js';
import {
  adminReviewVerificationBodySchema,
  adminSignalUpdateBodySchema,
  adminSkillStatusBodySchema,
  providerIdAdminParamSchema,
  signalIdParamSchema,
  skillIdParamSchema,
  verificationIdParamSchema,
} from '@/validators/phase9.js';
import * as discoveryAdminController from '@/modules/discovery-growth/discovery-growth-admin.controller.js';
import * as homeCarouselAdminController from '@/modules/home-carousel/home-carousel-admin.controller.js';
import {
  bundleIdParamSchema,
  campaignBodySchema,
  experimentBodySchema,
  featureFlagBodySchema,
  promotionBodySchema,
  searchSynonymBodySchema,
  seasonalRuleBodySchema,
  serviceBundleBodySchema,
} from '@/validators/phase10.js';
import {
  homeCarouselBodySchema,
  homeCarouselIdParamSchema,
  homeCarouselUpdateBodySchema,
} from '@/validators/home-carousel.js';
import * as operationsAdminController from '@/modules/operations/operations-admin.controller.js';
import * as carePlansAdminController from '@/modules/care-plans/care-plans-admin.controller.js';
import * as intelligenceAdminController from '@/modules/intelligence/intelligence-admin.controller.js';
import {
  cityBodySchema,
  serviceZoneBodySchema,
  zoneAvailabilityBodySchema,
  zoneDemandQuerySchema,
  waitlistAdminQuerySchema,
} from '@/validators/phase11.js';
import {
  adjustEntitlementBodySchema,
  adminSubscriptionStatusBodySchema,
  adminSubscriptionsQuerySchema,
  createPlanBodySchema,
  planBenefitBodySchema,
  planPriceBodySchema,
} from '@/validators/phase12.js';
import {
  createBrandBodySchema,
  createCommissionRuleBodySchema,
  createCompatibilityRuleBodySchema,
} from '@/validators/phase15.js';
import * as marketplaceAdminController from '@/modules/marketplace/marketplace-admin.controller.js';
import * as iotAdminController from '@/modules/iot/iot-admin.controller.js';
import * as networkAdminController from '@/modules/network/network-admin.controller.js';
import * as trustAdminController from '@/modules/trust-protection/trust-admin.controller.js';
import * as financeAdminController from '@/modules/finance/finance-admin.controller.js';
import * as growthAdminController from '@/modules/customer-lifecycle/growth-admin.controller.js';
import * as reliabilityAdminController from '@/modules/reliability/operations-reliability.controller.js';
import * as securityAdminController from '@/modules/security/security-admin.controller.js';
import * as performanceAdminController from '@/modules/performance/performance-admin.controller.js';
import * as globalizationAdminController from '@/modules/globalization/globalization-admin.controller.js';
import {
  lifecycleCampaignBodySchema,
  campaignIdParamSchema,
  campaignQuerySchema,
  churnQuerySchema,
  experimentIdParamSchema,
} from '@/validators/phase20.js';
import {
  incidentBodySchema,
  incidentUpdateSchema,
  dlqDiscardSchema,
  idParamSchema as phase21IdParamSchema,
} from '@/validators/phase21.js';
import {
  roleBodySchema,
  roleUpdateSchema,
  roleKeyParamSchema,
  threatModelBodySchema,
  findingUpdateSchema,
  findingIdParamSchema,
} from '@/validators/phase22.js';
import {
  indexReviewBodySchema,
  loadTestIdParamSchema,
  slowQueryQuerySchema,
} from '@/validators/phase23.js';
import {
  createRegionBodySchema,
  updateRegionBodySchema,
  regionConfigBodySchema,
  createServiceAreaBodySchema,
  createPartnerBodySchema,
} from '@/validators/phase24.js';
import { objectIdSchema } from '@ghaarfix/validation';
import { adminAuthLimiter } from '@/middleware/adminAuthRateLimit.js';
import {
  ledgerQuerySchema,
  reconciliationQuerySchema,
  alertsQuerySchema,
  adjustmentBodySchema,
  bookingIdFinanceParamSchema,
  alertIdParamSchema,
  approvalIdParamSchema,
} from '@/validators/phase19.js';
import { createRuleTemplateBodySchema } from '@/validators/phase16.js';
import { expansionIdParamSchema, launchPlanBodySchema, networkQuerySchema } from '@/validators/phase17.js';
import {
  certificationBodySchema,
  completeInspectionBodySchema,
  guaranteePolicyBodySchema,
  improvementPlanBodySchema,
  inspectionBodySchema,
  policyIdParamSchema,
  inspectionIdParamSchema,
  refundBodySchema,
  trustQuerySchema,
  updateClaimBodySchema,
} from '@/validators/phase18.js';

const router = Router();

router.post('/login', adminAuthLimiter, validateBody(adminLoginSchema), adminController.login);

router.get(
  '/dashboard',
  authenticate,
  authorize(UserRole.ADMIN),
  adminController.dashboard,
);

router.get(
  '/customers',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminCustomersListQuerySchema),
  userAdminController.listCustomers,
);

router.get(
  '/customers/:userId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(adminUserIdParamSchema),
  userAdminController.getCustomer,
);

router.patch(
  '/customers/:userId/status',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(adminUserIdParamSchema),
  validateBody(adminUpdateCustomerStatusBodySchema),
  userAdminController.updateCustomerStatus,
);

router.get(
  '/providers',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminProvidersListQuerySchema),
  userAdminController.listProviders,
);

router.get(
  '/providers/:providerId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(adminProviderIdParamSchema),
  userAdminController.getProvider,
);

router.patch(
  '/providers/:providerId/status',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(adminProviderIdParamSchema),
  validateBody(adminUpdateProviderStatusBodySchema),
  userAdminController.updateProviderStatus,
);

router.get(
  '/audit-logs',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminCustomersListQuerySchema),
  platformAdminController.listAuditLogs,
);

router.get(
  '/platform-notifications',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminCustomersListQuerySchema),
  platformAdminController.listNotifications,
);

router.post(
  '/platform-notifications/send',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(sendPlatformNotificationBodySchema),
  platformAdminController.sendPlatformNotification,
);

router.post(
  '/platform-notifications/test',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(sendTestPlatformNotificationBodySchema),
  platformAdminController.sendTestPlatformNotification,
);

router.get(
  '/disputes',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminCustomersListQuerySchema),
  platformAdminController.listDisputes,
);

router.get(
  '/categories',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminListQuerySchema),
  catalogAdminController.listCategories,
);
router.get(
  '/uploads/config',
  authenticate,
  authorize(UserRole.ADMIN),
  uploadAdminController.getUploadConfig,
);
router.post(
  '/uploads/image',
  authenticate,
  authorize(UserRole.ADMIN),
  uploadMiddleware.single('file'),
  uploadAdminController.uploadCatalogImage,
);
router.post(
  '/categories',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(categoryCreateBodySchema),
  catalogAdminController.createCategory,
);
router.patch(
  '/categories/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(categoryBodySchema.partial()),
  catalogAdminController.updateCategory,
);
router.delete(
  '/categories/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  catalogAdminController.deleteCategory,
);

router.get(
  '/subcategories',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminListQuerySchema),
  catalogAdminController.listSubcategories,
);
router.post(
  '/subcategories',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(subcategoryCreateBodySchema),
  catalogAdminController.createSubcategory,
);
router.patch(
  '/subcategories/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(subcategoryBodySchema.partial()),
  catalogAdminController.updateSubcategory,
);

router.get(
  '/services',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(serviceListQuerySchema),
  catalogAdminController.listServices,
);
router.post(
  '/services',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(serviceCreateBodySchema),
  catalogAdminController.createService,
);
router.get(
  '/services/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  catalogAdminController.getService,
);
router.patch(
  '/services/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(serviceBodySchema.partial()),
  catalogAdminController.updateService,
);

router.get(
  '/provider-services',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminListQuerySchema),
  catalogAdminController.listProviderServices,
);
router.patch(
  '/provider-services/:id/approve',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  catalogAdminController.approveProviderService,
);
router.patch(
  '/provider-services/:id/reject',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(rejectProviderServiceSchema),
  catalogAdminController.rejectProviderService,
);

router.get(
  '/providers/:providerId/availability-overview',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(providerIdParamSchema),
  adminAvailabilityController.getProviderAvailabilityOverview,
);

router.get(
  '/bookings',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminBookingListQuerySchema),
  bookingController.adminListBookings,
);
router.get(
  '/bookings/:bookingId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bookingIdParamSchema),
  bookingController.adminGetBooking,
);
router.get(
  '/payments',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(paginationQuerySchema),
  bookingController.adminListPayments,
);

router.get(
  '/urgent-requests',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminUrgentListQuerySchema),
  urgentAdminController.listUrgentRequests,
);
router.get(
  '/urgent-requests/:urgentRequestId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(urgentRequestIdParamSchema),
  urgentAdminController.getUrgentRequest,
);
router.post(
  '/urgent-requests/:urgentRequestId/cancel',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(urgentRequestIdParamSchema),
  validateBody(cancelUrgentBodySchema.extend({ reason: z.string().min(3) })),
  urgentAdminController.cancelUrgentRequest,
);

router.get(
  '/urgent/config',
  authenticate,
  authorize(UserRole.ADMIN),
  urgentAdminController.getDispatchConfig,
);
router.put(
  '/urgent/config',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(
    z
      .object({
        invitationTtlSeconds: z.coerce.number().int().positive().optional(),
        waveIntervalSeconds: z.coerce.number().int().positive().optional(),
        batchSize: z.coerce.number().int().positive().max(10).optional(),
        retryCooldownSeconds: z.coerce.number().int().positive().optional(),
        noShowMinutes: z.coerce.number().int().positive().optional(),
        maxRadiusKm: z.coerce.number().positive().max(100).optional(),
        maxBroadcastProviders: z.coerce.number().int().positive().max(50).optional(),
      })
      .strict(),
  ),
  urgentAdminController.updateDispatchConfig,
);

router.get(
  '/invoices',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(paginationQuerySchema),
  postServiceController.adminListInvoices,
);
router.get(
  '/reviews',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminListReviewsQuerySchema),
  postServiceController.adminListReviews,
);
router.patch(
  '/reviews/:reviewId/moderation',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(reviewIdParamSchema),
  validateBody(reviewModerationBodySchema),
  postServiceController.adminModerateReview,
);
router.get(
  '/support-tickets',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminListTicketsQuerySchema),
  postServiceController.adminListSupportTickets,
);
router.get(
  '/support-tickets/:ticketId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(ticketIdParamSchema),
  postServiceController.adminGetSupportTicket,
);
router.patch(
  '/support-tickets/:ticketId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(ticketIdParamSchema),
  validateBody(adminTicketUpdateBodySchema),
  postServiceController.adminUpdateSupportTicket,
);

router.get(
  '/asset-types',
  authenticate,
  authorize(UserRole.ADMIN),
  homeHealthController.adminListAssetTypes,
);
router.post(
  '/asset-types',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(assetTypeBodySchema),
  homeHealthController.adminCreateAssetType,
);
router.patch(
  '/asset-types/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(assetTypeBodySchema.partial().omit({ slug: true })),
  homeHealthController.adminUpdateAssetType,
);
router.get(
  '/maintenance-templates',
  authenticate,
  authorize(UserRole.ADMIN),
  homeHealthController.adminListMaintenanceTemplates,
);
router.post(
  '/maintenance-templates',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(maintenanceTemplateBodySchema),
  homeHealthController.adminCreateMaintenanceTemplate,
);
router.patch(
  '/maintenance-templates/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(maintenanceTemplateBodySchema.partial().omit({ assetTypeId: true, serviceId: true })),
  homeHealthController.adminUpdateMaintenanceTemplate,
);

router.get(
  '/provider-verifications',
  authenticate,
  authorize(UserRole.ADMIN),
  providerQualityController.adminListVerifications,
);
router.patch(
  '/provider-verifications/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(verificationIdParamSchema),
  validateBody(adminReviewVerificationBodySchema),
  providerQualityController.adminReviewVerification,
);
router.patch(
  '/provider-skills/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(skillIdParamSchema),
  validateBody(adminSkillStatusBodySchema),
  providerQualityController.adminUpdateSkill,
);
router.get(
  '/providers/:providerId/performance',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(providerIdAdminParamSchema),
  providerQualityController.adminGetProviderPerformance,
);
router.get(
  '/operational-signals',
  authenticate,
  authorize(UserRole.ADMIN),
  providerQualityController.adminListSignals,
);
router.patch(
  '/operational-signals/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(signalIdParamSchema),
  validateBody(adminSignalUpdateBodySchema),
  providerQualityController.adminUpdateSignal,
);
router.get(
  '/operations/dashboard',
  authenticate,
  authorize(UserRole.ADMIN),
  providerQualityController.adminOperationsDashboard,
);
router.get(
  '/analytics/service-quality',
  authenticate,
  authorize(UserRole.ADMIN),
  providerQualityController.adminServiceQuality,
);

router.get(
  '/search-insights',
  authenticate,
  authorize(UserRole.ADMIN),
  discoveryAdminController.getSearchInsights,
);
router.get(
  '/growth-analytics',
  authenticate,
  authorize(UserRole.ADMIN),
  discoveryAdminController.getGrowthAnalytics,
);

router.get('/promotions', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listPromotions);
router.post(
  '/promotions',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(promotionBodySchema),
  discoveryAdminController.createPromotion,
);
router.patch(
  '/promotions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(promotionBodySchema.partial()),
  discoveryAdminController.updatePromotion,
);
router.delete(
  '/promotions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deletePromotion,
);

router.get(
  '/home-carousel',
  authenticate,
  authorize(UserRole.ADMIN),
  homeCarouselAdminController.listHomeCarouselItems,
);
router.post(
  '/home-carousel',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(homeCarouselBodySchema),
  homeCarouselAdminController.createHomeCarouselItem,
);
router.patch(
  '/home-carousel/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(homeCarouselIdParamSchema),
  validateBody(homeCarouselUpdateBodySchema),
  homeCarouselAdminController.updateHomeCarouselItem,
);
router.delete(
  '/home-carousel/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(homeCarouselIdParamSchema),
  homeCarouselAdminController.deleteHomeCarouselItem,
);

router.get('/service-bundles', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listServiceBundles);
router.post(
  '/service-bundles',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(serviceBundleBodySchema),
  discoveryAdminController.createServiceBundle,
);
router.patch(
  '/service-bundles/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bundleIdParamSchema),
  validateBody(serviceBundleBodySchema.partial()),
  discoveryAdminController.updateServiceBundle,
);
router.delete(
  '/service-bundles/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bundleIdParamSchema),
  discoveryAdminController.deleteServiceBundle,
);

router.get('/feature-flags', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listFeatureFlags);
router.post(
  '/feature-flags',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(featureFlagBodySchema),
  discoveryAdminController.createFeatureFlag,
);
router.patch(
  '/feature-flags/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(featureFlagBodySchema.partial()),
  discoveryAdminController.updateFeatureFlag,
);
router.delete(
  '/feature-flags/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deleteFeatureFlag,
);

router.get('/experiments', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listExperiments);
router.post(
  '/experiments',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(experimentBodySchema),
  discoveryAdminController.createExperiment,
);
router.patch(
  '/experiments/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(experimentBodySchema.partial()),
  discoveryAdminController.updateExperiment,
);
router.delete(
  '/experiments/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deleteExperiment,
);

router.get('/campaigns', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listCampaigns);
router.post(
  '/campaigns',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(campaignBodySchema),
  discoveryAdminController.createCampaign,
);
router.patch(
  '/campaigns/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(campaignBodySchema.partial()),
  discoveryAdminController.updateCampaign,
);
router.delete(
  '/campaigns/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deleteCampaign,
);
router.get(
  '/campaigns/:id/audience-preview',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.previewCampaignAudience,
);

router.get('/search-synonyms', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listSearchSynonyms);
router.post(
  '/search-synonyms',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(searchSynonymBodySchema),
  discoveryAdminController.createSearchSynonym,
);
router.patch(
  '/search-synonyms/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(searchSynonymBodySchema.partial()),
  discoveryAdminController.updateSearchSynonym,
);
router.delete(
  '/search-synonyms/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deleteSearchSynonym,
);

router.get('/seasonal-rules', authenticate, authorize(UserRole.ADMIN), discoveryAdminController.listSeasonalRules);
router.post(
  '/seasonal-rules',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(seasonalRuleBodySchema),
  discoveryAdminController.createSeasonalRule,
);
router.patch(
  '/seasonal-rules/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(seasonalRuleBodySchema.partial()),
  discoveryAdminController.updateSeasonalRule,
);
router.delete(
  '/seasonal-rules/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  discoveryAdminController.deleteSeasonalRule,
);

// Phase 11 — operations & scale
router.get('/cities', authenticate, authorize(UserRole.ADMIN), operationsAdminController.adminListCities);
router.post(
  '/cities',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(cityBodySchema),
  operationsAdminController.adminCreateCity,
);
router.patch(
  '/cities/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(cityBodySchema.partial()),
  operationsAdminController.adminUpdateCity,
);
router.delete(
  '/cities/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  operationsAdminController.adminDeleteCity,
);

router.get('/service-zones', authenticate, authorize(UserRole.ADMIN), operationsAdminController.adminListServiceZones);
router.post(
  '/service-zones',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(serviceZoneBodySchema),
  operationsAdminController.adminCreateServiceZone,
);
router.patch(
  '/service-zones/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(serviceZoneBodySchema.partial()),
  operationsAdminController.adminUpdateServiceZone,
);
router.delete(
  '/service-zones/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  operationsAdminController.adminDeleteServiceZone,
);

router.post(
  '/zone-availability',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(zoneAvailabilityBodySchema),
  operationsAdminController.adminUpsertZoneAvailability,
);
router.delete(
  '/zone-availability',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(zoneAvailabilityBodySchema.pick({ serviceZoneId: true, serviceId: true })),
  operationsAdminController.adminDeleteZoneAvailability,
);

router.get(
  '/zone-demand',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(zoneDemandQuerySchema),
  operationsAdminController.adminZoneDemand,
);
router.get(
  '/provider-capacity',
  authenticate,
  authorize(UserRole.ADMIN),
  operationsAdminController.adminProviderCapacity,
);
router.get(
  '/waitlist',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(waitlistAdminQuerySchema),
  operationsAdminController.adminWaitlist,
);
router.get(
  '/waitlist/summary',
  authenticate,
  authorize(UserRole.ADMIN),
  operationsAdminController.adminWaitlistSummary,
);
router.get(
  '/system-health',
  authenticate,
  authorize(UserRole.ADMIN),
  operationsAdminController.adminSystemHealth,
);
router.get(
  '/queues',
  authenticate,
  authorize(UserRole.ADMIN),
  operationsAdminController.adminQueueStats,
);
router.get(
  '/queues/dlq',
  authenticate,
  authorize(UserRole.ADMIN),
  operationsAdminController.adminDlq,
);

// Phase 12 — Care Plans
router.get('/care-plans', authenticate, authorize(UserRole.ADMIN), carePlansAdminController.adminListPlans);
router.post(
  '/care-plans',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createPlanBodySchema),
  carePlansAdminController.adminCreatePlan,
);
router.post(
  '/care-plans/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  carePlansAdminController.adminActivatePlan,
);
router.post(
  '/care-plans/:id/publish-version',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  carePlansAdminController.adminPublishVersion,
);
router.post(
  '/care-plans/:id/prices',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(planPriceBodySchema),
  carePlansAdminController.adminUpsertPrice,
);
router.post(
  '/care-plans/:id/benefits',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(planBenefitBodySchema),
  carePlansAdminController.adminAddBenefit,
);
router.get(
  '/subscriptions',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminSubscriptionsQuerySchema),
  carePlansAdminController.adminListSubscriptions,
);
router.get(
  '/subscriptions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  carePlansAdminController.adminGetSubscription,
);
router.post(
  '/subscriptions/:id/adjust-entitlement',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(adjustEntitlementBodySchema),
  carePlansAdminController.adminAdjustEntitlement,
);
router.post(
  '/subscriptions/:id/change-status',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(adminSubscriptionStatusBodySchema),
  carePlansAdminController.adminChangeStatus,
);
router.get(
  '/subscription-analytics',
  authenticate,
  authorize(UserRole.ADMIN),
  carePlansAdminController.adminAnalytics,
);

// Phase 14 — Intelligence Platform
router.get(
  '/intelligence/dashboard',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.getDashboard,
);
router.get(
  '/intelligence/demand-forecast',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.getDemandForecast,
);
router.get(
  '/intelligence/anomalies',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.listAnomalies,
);
router.post(
  '/intelligence/anomalies/:id/acknowledge',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  intelligenceAdminController.acknowledgeAnomaly,
);
router.get(
  '/intelligence/provider-matching',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.getProviderMatchingAnalytics,
);
router.get(
  '/intelligence/models',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.listModels,
);
router.post(
  '/intelligence/models/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  intelligenceAdminController.activateModel,
);
router.get(
  '/intelligence/data-readiness',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.getDataReadiness,
);
router.get(
  '/intelligence/knowledge-sources',
  authenticate,
  authorize(UserRole.ADMIN),
  intelligenceAdminController.listKnowledgeSources,
);
router.post(
  '/intelligence/knowledge-sources',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(z.object({
    type: z.enum(['FAQ', 'POLICY', 'SERVICE_DOCUMENT', 'APPROVED_HELP_CONTENT']),
    title: z.string().min(2),
    slug: z.string().min(2),
  })),
  intelligenceAdminController.createKnowledgeSource,
);
router.post(
  '/intelligence/knowledge-sources/:id/chunks',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(z.object({ content: z.string().min(10) })),
  intelligenceAdminController.addKnowledgeChunk,
);

// Phase 15 — Trusted Marketplace
router.get(
  '/marketplace/products',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListProducts,
);
router.post(
  '/marketplace/products/:id/approve',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  marketplaceAdminController.adminApproveProduct,
);
router.get(
  '/marketplace/brands',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListBrands,
);
router.post(
  '/marketplace/brands',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createBrandBodySchema),
  marketplaceAdminController.adminCreateBrand,
);
router.get(
  '/marketplace/partners',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListPartners,
);
router.post(
  '/marketplace/partners/:id/approve',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  marketplaceAdminController.adminApprovePartner,
);
router.get(
  '/marketplace/orders',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListOrders,
);
router.get(
  '/marketplace/returns',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListReturns,
);
router.get(
  '/marketplace/compatibility-rules',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListCompatibilityRules,
);
router.post(
  '/marketplace/compatibility-rules',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createCompatibilityRuleBodySchema),
  marketplaceAdminController.adminCreateCompatibilityRule,
);
router.get(
  '/marketplace/commission-rules',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminListCommissionRules,
);
router.post(
  '/marketplace/commission-rules',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createCommissionRuleBodySchema),
  marketplaceAdminController.adminCreateCommissionRule,
);
router.get(
  '/marketplace/analytics',
  authenticate,
  authorize(UserRole.ADMIN),
  marketplaceAdminController.adminAnalytics,
);

// Phase 16 — Connected Home Intelligence
router.get(
  '/iot/overview',
  authenticate,
  authorize(UserRole.ADMIN),
  iotAdminController.adminOverview,
);
router.get(
  '/iot/events',
  authenticate,
  authorize(UserRole.ADMIN),
  iotAdminController.adminListEvents,
);
router.get(
  '/iot/integrations',
  authenticate,
  authorize(UserRole.ADMIN),
  iotAdminController.adminListIntegrations,
);
router.get(
  '/iot/integration-health',
  authenticate,
  authorize(UserRole.ADMIN),
  iotAdminController.adminIntegrationHealth,
);
router.get(
  '/iot/rule-templates',
  authenticate,
  authorize(UserRole.ADMIN),
  iotAdminController.adminListRuleTemplates,
);
router.post(
  '/iot/rule-templates',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createRuleTemplateBodySchema),
  iotAdminController.adminCreateRuleTemplate,
);
router.post(
  '/iot/rule-templates/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  iotAdminController.adminActivateRuleTemplate,
);

// Phase 17 — Hyperlocal Network Intelligence
router.get(
  '/network/overview',
  authenticate,
  authorize(UserRole.ADMIN),
  networkAdminController.getOverview,
);
router.get(
  '/network/capacity',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getCapacity,
);
router.get(
  '/network/coverage-gaps',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getCoverageGaps,
);
router.get(
  '/network/wait-times',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getWaitTimes,
);
router.get(
  '/network/quality',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getQuality,
);
router.get(
  '/network/recruitment',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getRecruitment,
);
router.get(
  '/network/launch-readiness',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getLaunchReadiness,
);
router.get(
  '/network/expansion',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.getExpansion,
);
router.post(
  '/network/expansion/:id/acknowledge',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(expansionIdParamSchema),
  networkAdminController.acknowledgeExpansion,
);
router.post(
  '/network/launch-plans',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(launchPlanBodySchema),
  networkAdminController.createLaunchPlan,
);
router.get(
  '/network/alerts',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(networkQuerySchema),
  networkAdminController.listSupplyAlerts,
);

// Phase 18 — Trust & Customer Protection
router.get('/trust/overview', authenticate, authorize(UserRole.ADMIN), trustAdminController.getOverview);
router.get('/trust/analytics', authenticate, authorize(UserRole.ADMIN), trustAdminController.getAnalytics);
router.get('/trust/guarantee-policies', authenticate, authorize(UserRole.ADMIN), trustAdminController.listPolicies);
router.post(
  '/trust/guarantee-policies',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(guaranteePolicyBodySchema),
  trustAdminController.createPolicy,
);
router.patch(
  '/trust/guarantee-policies/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(policyIdParamSchema),
  validateBody(guaranteePolicyBodySchema.partial()),
  trustAdminController.updatePolicy,
);
router.post(
  '/trust/guarantee-policies/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(policyIdParamSchema),
  trustAdminController.activatePolicy,
);
router.get(
  '/trust/claims',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(trustQuerySchema),
  trustAdminController.listClaims,
);
router.patch(
  '/trust/claims/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(updateClaimBodySchema),
  trustAdminController.updateClaim,
);
router.get(
  '/trust/inspections',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(trustQuerySchema),
  trustAdminController.listInspections,
);
router.post(
  '/trust/inspections',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(inspectionBodySchema),
  trustAdminController.createInspection,
);
router.post(
  '/trust/inspections/:id/complete',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(inspectionIdParamSchema),
  validateBody(completeInspectionBodySchema),
  trustAdminController.completeInspection,
);
router.get(
  '/trust/providers/quality',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(trustQuerySchema),
  trustAdminController.listProviderQuality,
);
router.post(
  '/trust/providers/:id/improvement-plan',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  validateBody(improvementPlanBodySchema),
  trustAdminController.createImprovementPlan,
);
router.post(
  '/trust/certifications',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(certificationBodySchema),
  trustAdminController.grantCertification,
);
router.post(
  '/trust/certifications/:id/revoke',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(objectIdParamSchema),
  trustAdminController.revokeCertification,
);
router.post(
  '/trust/bookings/:bookingId/refund',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bookingIdParamSchema),
  validateBody(refundBodySchema),
  trustAdminController.processRefund,
);

// Phase 19 — Finance & Business Intelligence
router.get('/finance/overview', authenticate, authorize(UserRole.ADMIN), financeAdminController.getOverview);
router.get(
  '/finance/ledger',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(ledgerQuerySchema),
  financeAdminController.getLedger,
);
router.get(
  '/finance/bookings/:bookingId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(bookingIdFinanceParamSchema),
  financeAdminController.getBookingEconomics,
);
router.get('/finance/services', authenticate, authorize(UserRole.ADMIN), financeAdminController.getServiceProfitability);
router.get('/finance/cities', authenticate, authorize(UserRole.ADMIN), financeAdminController.getCityProfitability);
router.get('/finance/zones', authenticate, authorize(UserRole.ADMIN), financeAdminController.getZoneProfitability);
router.get('/finance/payouts', authenticate, authorize(UserRole.ADMIN), financeAdminController.getPayouts);
router.get(
  '/finance/reconciliation',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(reconciliationQuerySchema),
  financeAdminController.getReconciliation,
);
router.get('/finance/subscriptions', authenticate, authorize(UserRole.ADMIN), financeAdminController.getSubscriptions);
router.get('/finance/marketplace', authenticate, authorize(UserRole.ADMIN), financeAdminController.getMarketplace);
router.get(
  '/finance/customer-economics',
  authenticate,
  authorize(UserRole.ADMIN),
  financeAdminController.getCustomerEconomics,
);
router.get('/finance/cash-flow', authenticate, authorize(UserRole.ADMIN), financeAdminController.getCashFlow);
router.get(
  '/finance/alerts',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(alertsQuerySchema),
  financeAdminController.getAlerts,
);
router.post(
  '/finance/alerts/:id/acknowledge',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(alertIdParamSchema),
  financeAdminController.acknowledgeAlert,
);
router.post(
  '/finance/adjustments',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(adjustmentBodySchema),
  financeAdminController.createAdjustment,
);
router.post(
  '/finance/approvals/:id/approve',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(approvalIdParamSchema),
  financeAdminController.approveAdjustment,
);
router.post(
  '/finance/approvals/:id/reject',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(approvalIdParamSchema),
  financeAdminController.rejectAdjustment,
);

// Phase 20 — Growth, Retention & Lifecycle Intelligence
router.get('/growth/overview', authenticate, authorize(UserRole.ADMIN), growthAdminController.getOverview);
router.get('/growth/lifecycle', authenticate, authorize(UserRole.ADMIN), growthAdminController.getLifecycle);
router.get('/growth/retention', authenticate, authorize(UserRole.ADMIN), growthAdminController.getRetention);
router.get('/growth/cohorts', authenticate, authorize(UserRole.ADMIN), growthAdminController.getCohorts);
router.get(
  '/growth/churn',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(churnQuerySchema),
  growthAdminController.getChurn,
);
router.get('/growth/recommendations', authenticate, authorize(UserRole.ADMIN), growthAdminController.getRecommendations);
router.get(
  '/growth/campaigns',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(campaignQuerySchema),
  growthAdminController.listCampaigns,
);
router.post(
  '/growth/campaigns',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(lifecycleCampaignBodySchema),
  growthAdminController.createCampaign,
);
router.patch(
  '/growth/campaigns/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(campaignIdParamSchema),
  validateBody(lifecycleCampaignBodySchema.partial()),
  growthAdminController.updateCampaign,
);
router.post(
  '/growth/campaigns/:id/preview',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(campaignIdParamSchema),
  growthAdminController.previewCampaign,
);
router.post(
  '/growth/campaigns/:id/launch',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(campaignIdParamSchema),
  growthAdminController.launchCampaign,
);
router.post(
  '/growth/campaigns/:id/pause',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(campaignIdParamSchema),
  growthAdminController.pauseCampaign,
);
router.get(
  '/growth/experiments/:id/results',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(experimentIdParamSchema),
  growthAdminController.getExperimentResults,
);
router.get('/growth/referrals', authenticate, authorize(UserRole.ADMIN), growthAdminController.getReferrals);
router.get('/growth/loyalty', authenticate, authorize(UserRole.ADMIN), growthAdminController.getLoyalty);
router.get('/growth/attribution', authenticate, authorize(UserRole.ADMIN), growthAdminController.getAttribution);

// Phase 21 — reliability & observability
router.get(
  '/operations/overview',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getOverview,
);
router.get(
  '/operations/services',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getServices,
);
router.get(
  '/operations/errors',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getErrors,
);
router.get(
  '/operations/queues',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getQueues,
);
router.get(
  '/operations/slo',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getSlo,
);
router.get(
  '/operations/alerts',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getAlerts,
);
router.post(
  '/operations/alerts/:id/acknowledge',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(phase21IdParamSchema),
  reliabilityAdminController.acknowledgeAlert,
);
router.get(
  '/operations/incidents',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.listIncidents,
);
router.post(
  '/operations/incidents',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(incidentBodySchema),
  reliabilityAdminController.createIncident,
);
router.patch(
  '/operations/incidents/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(phase21IdParamSchema),
  validateBody(incidentUpdateSchema),
  reliabilityAdminController.updateIncident,
);
router.get(
  '/operations/dlq',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getDlq,
);
router.post(
  '/operations/dlq/:id/retry',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(phase21IdParamSchema),
  reliabilityAdminController.retryDlq,
);
router.post(
  '/operations/dlq/:id/discard',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(phase21IdParamSchema),
  validateBody(dlqDiscardSchema),
  reliabilityAdminController.discardDlq,
);
router.get(
  '/operations/backups',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getBackups,
);
router.get(
  '/operations/releases',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getReleases,
);
router.get(
  '/operations/health',
  authenticate,
  authorize(UserRole.ADMIN),
  reliabilityAdminController.getDetailedHealth,
);

// Phase 22 — security & compliance
router.get(
  '/security/overview',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getOverview,
);
router.get(
  '/security/events',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getEvents,
);
router.get(
  '/security/findings',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getFindings,
);
router.patch(
  '/security/findings/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(findingIdParamSchema),
  validateBody(findingUpdateSchema),
  securityAdminController.updateFinding,
);
router.get(
  '/security/audit-logs',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getAuditLogs,
);
router.get(
  '/security/data-assets',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getDataAssets,
);
router.get(
  '/security/data-exports',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getDataExports,
);
router.get(
  '/security/deletion-requests',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getDeletionRequests,
);
router.get(
  '/security/threat-models',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getThreatModels,
);
router.post(
  '/security/threat-models',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(threatModelBodySchema),
  securityAdminController.createThreatModel,
);
router.get(
  '/security/roles',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.listRoles,
);
router.post(
  '/security/roles',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(roleBodySchema),
  securityAdminController.createRole,
);
router.patch(
  '/security/roles/:key',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(roleKeyParamSchema),
  validateBody(roleUpdateSchema),
  securityAdminController.updateRole,
);
router.get(
  '/security/retention-policies',
  authenticate,
  authorize(UserRole.ADMIN),
  securityAdminController.getRetentionPolicies,
);

// Phase 23 — scale, performance & optimization
router.get(
  '/performance/overview',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getOverview,
);
router.get(
  '/performance/api',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getApiPerformance,
);
router.get(
  '/performance/database',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getDatabasePerformance,
);
router.get(
  '/performance/slow-queries',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(slowQueryQuerySchema),
  performanceAdminController.getSlowQueries,
);
router.get(
  '/performance/indexes',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getIndexAudit,
);
router.patch(
  '/performance/indexes/:id/review',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  validateBody(indexReviewBodySchema),
  performanceAdminController.reviewIndex,
);
router.get(
  '/performance/cache',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getCachePerformance,
);
router.get(
  '/performance/queues',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getQueuePerformance,
);
router.get(
  '/performance/realtime',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getRealtimePerformance,
);
router.get(
  '/performance/mobile',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getMobilePerformance,
);
router.get(
  '/performance/load-tests',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getLoadTests,
);
router.post(
  '/performance/load-tests/:id/run',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(loadTestIdParamSchema),
  performanceAdminController.runLoadTest,
);
router.get(
  '/performance/capacity',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getCapacity,
);
router.get(
  '/performance/costs',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getCosts,
);
router.get(
  '/performance/regressions',
  authenticate,
  authorize(UserRole.ADMIN),
  performanceAdminController.getRegressions,
);

// Phase 24 — globalization & multi-region
router.get(
  '/expansion/analytics',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.getExpansionAnalytics,
);
router.get(
  '/regions',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.listRegions,
);
router.post(
  '/regions',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createRegionBodySchema),
  globalizationAdminController.createRegion,
);
router.get(
  '/regions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.getRegion,
);
router.patch(
  '/regions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  validateBody(updateRegionBodySchema),
  globalizationAdminController.updateRegion,
);
router.post(
  '/regions/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.activateRegion,
);
router.post(
  '/regions/:id/deactivate',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.deactivateRegion,
);
router.get(
  '/regions/:id/configuration',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.getRegionConfiguration,
);
router.patch(
  '/regions/:id/configuration',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  validateBody(regionConfigBodySchema),
  globalizationAdminController.updateRegionConfiguration,
);
router.get(
  '/regions/:id/launch-checklist',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.getLaunchChecklist,
);
router.get(
  '/service-areas',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.listServiceAreas,
);
router.post(
  '/service-areas',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createServiceAreaBodySchema),
  globalizationAdminController.createServiceArea,
);
router.patch(
  '/service-areas/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.updateServiceArea,
);
router.get(
  '/regional-catalog',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.getRegionalCatalog,
);
router.get(
  '/regional-pricing',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.getRegionalPricing,
);
router.get(
  '/regional-taxes',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.getRegionalTaxes,
);
router.get(
  '/regional-payments',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.getRegionalPayments,
);
router.get(
  '/partners',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.listPartners,
);
router.post(
  '/partners',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createPartnerBodySchema),
  globalizationAdminController.createPartner,
);
router.get(
  '/partners/:id/performance',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(z.object({ id: objectIdSchema })),
  globalizationAdminController.getPartnerPerformance,
);
router.get(
  '/data-residency',
  authenticate,
  authorize(UserRole.ADMIN),
  globalizationAdminController.listDataResidency,
);

router.get(
  '/app-versions',
  authenticate,
  authorize(UserRole.ADMIN),
  appVersionAdminController.listAppVersions,
);
router.put(
  '/app-versions',
  authenticate,
  authorize(UserRole.ADMIN),
  appVersionAdminController.upsertAppVersion,
);
router.delete(
  '/app-versions/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  appVersionAdminController.deleteAppVersion,
);

router.get(
  '/home-help/duration-packages',
  authenticate,
  authorize(UserRole.ADMIN),
  homeHelpAdminController.listPackages,
);
router.post(
  '/home-help/duration-packages',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(homeHelpDurationPackageBodySchema),
  homeHelpAdminController.createPackage,
);
router.patch(
  '/home-help/duration-packages/:packageId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(homeHelpPackageIdParamSchema),
  validateBody(homeHelpDurationPackageUpdateSchema),
  homeHelpAdminController.updatePackage,
);
router.delete(
  '/home-help/duration-packages/:packageId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(homeHelpPackageIdParamSchema),
  homeHelpAdminController.removePackage,
);

router.get(
  '/home-help/compatibility-config',
  authenticate,
  authorize(UserRole.ADMIN),
  homeHelpAdminController.getCompatibilityConfig,
);
router.patch(
  '/home-help/compatibility-config',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(homeHelpCompatibilityConfigBodySchema),
  homeHelpAdminController.updateCompatibilityConfig,
);

router.get(
  '/home-help/recurring-plans',
  authenticate,
  authorize(UserRole.ADMIN),
  validateQuery(adminRecurringPlanListQuerySchema),
  recurringController.adminListPlans,
);
router.patch(
  '/home-help/recurring-plans/:planId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(recurringPlanIdParamSchema),
  validateBody(adminUpdateRecurringPlanBodySchema),
  recurringController.adminUpdatePlan,
);

export default router;

export enum ServiceProviderType {
  SERVICE_PROFESSIONAL = 'SERVICE_PROFESSIONAL',
  HOME_HELP_PRO = 'HOME_HELP_PRO',
}

export enum HomeHelpTaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum HomeHelpCompatibilityGroup {
  HOME_HELP = 'HOME_HELP',
  CLEANING = 'CLEANING',
  LAUNDRY = 'LAUNDRY',
  KITCHEN = 'KITCHEN',
  SPECIALIST = 'SPECIALIST',
}

export interface HomeHelpTaskSelection {
  serviceId: string;
  priority: HomeHelpTaskPriority;
  notes?: string;
}

export interface HomeHelpTaskSnapshot {
  serviceId: string;
  name: string;
  priority: HomeHelpTaskPriority;
  notes?: string;
}

export interface HomeHelpDurationPackageSummary {
  id: string;
  label: string;
  durationMinutes: number;
  basePrice: number;
  currency: string;
  displayOrder: number;
}

export interface HomeHelpQuoteLineItem {
  label: string;
  amount: number;
}

export interface HomeHelpQuote {
  durationPackage: HomeHelpDurationPackageSummary;
  tasks: HomeHelpTaskSnapshot[];
  lineItems: HomeHelpQuoteLineItem[];
  taskAddonTotal: number;
  bundleDiscount: number;
  bundleDiscountLabel?: string;
  subtotal: number;
  currency: string;
  disclaimer: string;
}

export interface HomeHelpCatalogTask {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  image?: string;
  compatibilityGroup: HomeHelpCompatibilityGroup;
  startingPrice?: number;
  currency: string;
}

export interface HomeHelpCatalogResponse {
  anchorServiceId: string;
  tasks: HomeHelpCatalogTask[];
  durationPackages: HomeHelpDurationPackageSummary[];
  disclaimer: string;
  compatibility: {
    maxTasksPerVisit: number;
    specialistExclusive: boolean;
    requireHomeHelpForMixedGroups: boolean;
    stackingRules: string[];
  };
}

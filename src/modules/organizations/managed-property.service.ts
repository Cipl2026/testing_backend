import {
  ErrorCode,
  ManagedPropertyStatus,
  ManagedPropertyType,
  OrganizationPermission,
  PropertyOccupantStatus,
  PropertyOccupantType,
  PropertyUnitStatus,
} from '@ghaarfix/shared-types';
import mongoose from 'mongoose';
import {
  ManagedProperty,
  PropertyOccupant,
  PropertyUnit,
} from '@/models/ManagedProperty.js';
import { Home } from '@/models/Home.js';
import { HomeAsset } from '@/models/HomeAsset.js';
import {
  assertOrganizationPermission,
  assertPropertyInOrganization,
} from '@/modules/organizations/organization-authorization.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { AppError } from '@/utils/AppError.js';

function serializeProperty(p: InstanceType<typeof ManagedProperty>) {
  return {
    id: p._id.toString(),
    organizationId: p.organizationId.toString(),
    name: p.name,
    type: p.type,
    address: p.address,
    cityId: p.cityId?.toString(),
    serviceZoneId: p.serviceZoneId?.toString(),
    homeId: p.homeId?.toString(),
    status: p.status,
    metadata: p.metadata,
  };
}

export async function createProperty(
  userId: string,
  organizationId: string,
  input: {
    name: string;
    type: ManagedPropertyType;
    address: IManagedPropertyAddress;
    cityId?: string;
    serviceZoneId?: string;
    linkHomeId?: string;
  },
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);

  const property = await ManagedProperty.create({
    organizationId,
    name: input.name,
    type: input.type,
    address: input.address,
    cityId: input.cityId,
    serviceZoneId: input.serviceZoneId,
    homeId: input.linkHomeId,
    status: ManagedPropertyStatus.ACTIVE,
    location: input.address.latitude
      ? {
          type: 'Point',
          coordinates: [input.address.longitude!, input.address.latitude],
        }
      : undefined,
  });

  await logOrganizationAudit({
    organizationId,
    actorId: userId,
    action: 'PROPERTY_CREATED',
    resourceType: 'ManagedProperty',
    resourceId: property._id.toString(),
    after: { name: property.name, type: property.type },
  });

  return serializeProperty(property);
}

type IManagedPropertyAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
};

export async function listProperties(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  const items = await ManagedProperty.find({
    organizationId,
    status: { $ne: ManagedPropertyStatus.ARCHIVED },
  }).sort({ name: 1 });
  return items.map(serializeProperty);
}

export async function getProperty(userId: string, organizationId: string, propertyId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  const property = await assertPropertyInOrganization(organizationId, propertyId);
  return serializeProperty(property);
}

export async function updateProperty(
  userId: string,
  organizationId: string,
  propertyId: string,
  input: Partial<{ name: string; status: ManagedPropertyStatus; metadata: Record<string, unknown> }>,
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);
  const property = await ManagedProperty.findOneAndUpdate(
    { _id: propertyId, organizationId },
    { $set: input },
    { new: true },
  );
  if (!property) throw new AppError('Property not found.', 404, ErrorCode.NOT_FOUND);
  return serializeProperty(property);
}

export async function createUnit(
  userId: string,
  organizationId: string,
  propertyId: string,
  input: { name: string; unitNumber: string; floor?: string; type?: string },
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);
  await assertPropertyInOrganization(organizationId, propertyId);

  const unit = await PropertyUnit.create({
    organizationId,
    propertyId,
    name: input.name,
    unitNumber: input.unitNumber,
    floor: input.floor,
    type: input.type,
    status: PropertyUnitStatus.ACTIVE,
  });

  return {
    id: unit._id.toString(),
    propertyId,
    name: unit.name,
    unitNumber: unit.unitNumber,
    floor: unit.floor,
    status: unit.status,
  };
}

export async function listUnits(userId: string, organizationId: string, propertyId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  await assertPropertyInOrganization(organizationId, propertyId);
  const units = await PropertyUnit.find({ propertyId, organizationId });
  return units.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    unitNumber: u.unitNumber,
    floor: u.floor,
    status: u.status,
  }));
}

export async function createOccupant(
  userId: string,
  organizationId: string,
  propertyId: string,
  input: {
    unitId?: string;
    userId?: string;
    nameSnapshot: string;
    phoneSnapshot?: string;
    type: PropertyOccupantType;
  },
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);
  await assertPropertyInOrganization(organizationId, propertyId);

  const occupant = await PropertyOccupant.create({
    organizationId,
    propertyId,
    unitId: input.unitId,
    userId: input.userId,
    nameSnapshot: input.nameSnapshot,
    phoneSnapshot: input.phoneSnapshot,
    type: input.type,
    status: PropertyOccupantStatus.ACTIVE,
  });

  return {
    id: occupant._id.toString(),
    name: occupant.nameSnapshot,
    type: occupant.type,
    status: occupant.status,
  };
}

export async function listOccupants(userId: string, organizationId: string, propertyId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  await assertPropertyInOrganization(organizationId, propertyId);
  const items = await PropertyOccupant.find({ propertyId, organizationId, status: PropertyOccupantStatus.ACTIVE });
  return items.map((o) => ({
    id: o._id.toString(),
    name: o.nameSnapshot,
    type: o.type,
    unitId: o.unitId?.toString(),
    userId: o.userId?.toString(),
  }));
}

/** Link existing HomeAsset via property's linked home — tenant privacy: org only sees org-linked home assets */
export async function listPropertyAssets(userId: string, organizationId: string, propertyId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);
  const property = await assertPropertyInOrganization(organizationId, propertyId);
  if (!property.homeId) return [];

  const home = await Home.findOne({ _id: property.homeId, isArchived: false });
  if (!home) return [];

  const assets = await HomeAsset.find({ homeId: home._id, archivedAt: { $exists: false } });
  return assets.map((a) => ({
    id: a._id.toString(),
    name: a.name,
    assetTypeId: a.assetTypeId.toString(),
    brand: a.brand,
    model: a.model,
  }));
}

export async function linkPropertyHome(
  userId: string,
  organizationId: string,
  propertyId: string,
  homeId: string,
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);
  const home = await Home.findOne({ _id: homeId, isArchived: false });
  if (!home) throw new AppError('Home not found.', 404, ErrorCode.NOT_FOUND);

  const property = await ManagedProperty.findOneAndUpdate(
    { _id: propertyId, organizationId },
    { homeId: new mongoose.Types.ObjectId(homeId) },
    { new: true },
  );
  if (!property) throw new AppError('Property not found.', 404, ErrorCode.NOT_FOUND);
  return serializeProperty(property);
}

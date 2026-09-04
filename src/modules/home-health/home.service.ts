import { ErrorCode, HomeCapability, HomeType } from '@ghaarfix/shared-types';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { Home } from '@/models/Home.js';
import { getAccessibleHome } from '@/modules/home-health/helpers.js';
import { ensureOwnerMembership } from '@/modules/home-members/home-member.service.js';
import { assertHomeCapability, listAccessibleHomeIds } from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';

function serializeHome(home: InstanceType<typeof Home>, address?: InstanceType<typeof CustomerAddress>) {
  return {
    id: home._id.toString(),
    name: home.name,
    homeType: home.homeType,
    isPrimary: home.isPrimary,
    isArchived: home.isArchived,
    addressId: home.addressId.toString(),
    address: address
      ? {
          addressLine1: address.addressLine1,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
        }
      : undefined,
    createdAt: home.createdAt.toISOString(),
  };
}

export async function listHomes(customerId: string) {
  const homeIds = await listAccessibleHomeIds(customerId);
  const homes = await Home.find({ _id: { $in: homeIds }, isArchived: false }).sort({
    isPrimary: -1,
    createdAt: -1,
  });
  const result = [];
  for (const home of homes) {
    const address = await CustomerAddress.findById(home.addressId);
    result.push(serializeHome(home, address ?? undefined));
  }
  return result;
}

export async function createHome(
  customerId: string,
  input: { addressId: string; name: string; homeType?: HomeType; isPrimary?: boolean },
) {
  const address = await CustomerAddress.findOne({ _id: input.addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  if (input.isPrimary) {
    await Home.updateMany({ customerId }, { $set: { isPrimary: false } });
  }

  const existing = await Home.findOne({ customerId, addressId: input.addressId, isArchived: false });
  if (existing) {
    return serializeHome(existing, address);
  }

  const home = await Home.create({
    customerId,
    addressId: input.addressId,
    name: input.name,
    homeType: input.homeType ?? HomeType.APARTMENT,
    isPrimary: input.isPrimary ?? false,
  });

  const count = await Home.countDocuments({ customerId, isArchived: false });
  if (count === 1) {
    home.isPrimary = true;
    await home.save();
  }

  await ensureOwnerMembership(home._id.toString(), customerId);

  return serializeHome(home, address);
}

export async function getHome(customerId: string, homeId: string) {
  const home = await getAccessibleHome(customerId, homeId);
  const address = await CustomerAddress.findById(home.addressId);
  return serializeHome(home, address ?? undefined);
}

export async function updateHome(
  customerId: string,
  homeId: string,
  input: { name?: string; homeType?: HomeType; isPrimary?: boolean },
) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_EDIT);
  const home = await getAccessibleHome(customerId, homeId);
  if (input.isPrimary) {
    await Home.updateMany({ customerId }, { $set: { isPrimary: false } });
    home.isPrimary = true;
  }
  if (input.name) home.name = input.name;
  if (input.homeType) home.homeType = input.homeType;
  await home.save();
  const address = await CustomerAddress.findById(home.addressId);
  return serializeHome(home, address ?? undefined);
}

export async function archiveHome(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_EDIT);
  const home = await getAccessibleHome(customerId, homeId);
  home.isArchived = true;
  home.isPrimary = false;
  await home.save();
  return { id: home._id.toString(), isArchived: true };
}

export async function findOrCreateHomeForAddress(customerId: string, addressId: string) {
  let home = await Home.findOne({ customerId, addressId, isArchived: false });
  if (home) return home;
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) return null;
  home = await Home.create({
    customerId,
    addressId,
    name: 'My Home',
    homeType: HomeType.APARTMENT,
    isPrimary: (await Home.countDocuments({ customerId, isArchived: false })) === 0,
  });
  await ensureOwnerMembership(home._id.toString(), customerId);
  return home;
}

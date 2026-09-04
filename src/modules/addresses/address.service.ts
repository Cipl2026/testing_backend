import { ErrorCode } from '@ghaarfix/shared-types';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { AppError } from '@/utils/AppError.js';
import { serializeAddress } from '@/utils/availabilitySerializers.js';
import type { AddressBody } from '@/validators/availability.js';

async function clearDefaultAddresses(customerId: string) {
  await CustomerAddress.updateMany({ customerId, isDefault: true }, { $set: { isDefault: false } });
}

export async function listAddresses(customerId: string) {
  const items = await CustomerAddress.find({ customerId }).sort({ isDefault: -1, createdAt: -1 });
  return items.map(serializeAddress);
}

export async function getAddress(customerId: string, addressId: string) {
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);
  return serializeAddress(address);
}

export async function createAddress(customerId: string, input: AddressBody) {
  const count = await CustomerAddress.countDocuments({ customerId });
  const isDefault = input.isDefault ?? count === 0;

  if (isDefault) {
    await clearDefaultAddresses(customerId);
  }

  const address = await CustomerAddress.create({
    customerId,
    label: input.label,
    recipientName: input.recipientName,
    phone: input.phone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    landmark: input.landmark,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
    location: {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
    },
    isDefault,
  });

  if (isDefault) {
    await CustomerProfile.findOneAndUpdate({ userId: customerId }, { defaultAddressId: address._id });
  }

  return serializeAddress(address);
}

export async function updateAddress(customerId: string, addressId: string, input: Partial<AddressBody>) {
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  if (input.label) address.label = input.label;
  if (input.recipientName) address.recipientName = input.recipientName;
  if (input.phone) address.phone = input.phone;
  if (input.addressLine1) address.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) address.addressLine2 = input.addressLine2;
  if (input.landmark !== undefined) address.landmark = input.landmark;
  if (input.city) address.city = input.city;
  if (input.state) address.state = input.state;
  if (input.postalCode) address.postalCode = input.postalCode;
  if (input.country) address.country = input.country;
  if (input.latitude !== undefined && input.longitude !== undefined) {
    address.location = {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
    };
  }

  await address.save();
  return serializeAddress(address);
}

export async function deleteAddress(customerId: string, addressId: string) {
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  const wasDefault = address.isDefault;
  await address.deleteOne();

  if (wasDefault) {
    const next = await CustomerAddress.findOne({ customerId }).sort({ createdAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
      await CustomerProfile.findOneAndUpdate({ userId: customerId }, { defaultAddressId: next._id });
    } else {
      await CustomerProfile.findOneAndUpdate({ userId: customerId }, { $unset: { defaultAddressId: 1 } });
    }
  }
}

export async function setDefaultAddress(customerId: string, addressId: string) {
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);

  await clearDefaultAddresses(customerId);
  address.isDefault = true;
  await address.save();
  await CustomerProfile.findOneAndUpdate({ userId: customerId }, { defaultAddressId: address._id });

  return serializeAddress(address);
}

export async function getCustomerAddressForMatching(customerId: string, addressId: string) {
  const address = await CustomerAddress.findOne({ _id: addressId, customerId });
  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);
  return address;
}

import type { ICustomerAddress } from '@/models/CustomerAddress.js';
import type { IProviderSchedule } from '@/models/ProviderSchedule.js';
import type { IProviderServiceArea } from '@/models/ProviderServiceArea.js';
import type { IProviderTimeOff } from '@/models/ProviderTimeOff.js';
import type { ISlotReservation } from '@/models/SlotReservation.js';

export function serializeAddress(address: ICustomerAddress) {
  return {
    id: address._id.toString(),
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    location: {
      latitude: address.location.coordinates[1],
      longitude: address.location.coordinates[0],
    },
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function serializeServiceArea(area: IProviderServiceArea) {
  return {
    id: area._id.toString(),
    name: area.name,
    type: area.type,
    center: area.center,
    radiusKm: area.radiusKm,
    postalCodes: area.postalCodes,
    isActive: area.isActive,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  };
}

export function serializeSchedule(schedule: IProviderSchedule) {
  return {
    id: schedule._id.toString(),
    weeklySchedule: schedule.weeklySchedule,
    timezone: schedule.timezone,
    isActive: schedule.isActive,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export function serializeTimeOff(timeOff: IProviderTimeOff) {
  return {
    id: timeOff._id.toString(),
    startDateTime: timeOff.startDateTime.toISOString(),
    endDateTime: timeOff.endDateTime.toISOString(),
    reason: timeOff.reason,
    type: timeOff.type,
    createdAt: timeOff.createdAt.toISOString(),
    updatedAt: timeOff.updatedAt.toISOString(),
  };
}

export function serializeReservation(reservation: ISlotReservation) {
  return {
    id: reservation._id.toString(),
    providerId: reservation.providerId.toString(),
    serviceId: reservation.serviceId.toString(),
    addressId: reservation.addressId.toString(),
    startDateTime: reservation.startDateTime.toISOString(),
    endDateTime: reservation.endDateTime.toISOString(),
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
  };
}

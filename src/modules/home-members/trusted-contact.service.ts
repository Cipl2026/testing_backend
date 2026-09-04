import { ErrorCode, HomeCapability } from '@ghaarfix/shared-types';
import { TrustedContact } from '@/models/TrustedContact.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { AppError } from '@/utils/AppError.js';

export async function listTrustedContacts(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_VIEW);
  const items = await TrustedContact.find({ homeId }).sort({ createdAt: -1 });
  return items.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    phone: c.phone,
    relationship: c.relationship,
    isEmergencyContact: c.isEmergencyContact,
    notificationPreferences: c.notificationPreferences,
    customerId: c.customerId?.toString(),
  }));
}

export async function createTrustedContact(
  customerId: string,
  homeId: string,
  input: {
    name: string;
    phone: string;
    relationship?: string;
    isEmergencyContact?: boolean;
    notificationPreferences?: string[];
    linkedCustomerId?: string;
  },
) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_EDIT);
  const doc = await TrustedContact.create({
    homeId,
    customerId: input.linkedCustomerId,
    name: input.name,
    phone: input.phone,
    relationship: input.relationship,
    isEmergencyContact: input.isEmergencyContact ?? false,
    notificationPreferences: input.notificationPreferences ?? [],
  });
  return { id: doc._id.toString(), name: doc.name };
}

export async function updateTrustedContact(
  customerId: string,
  contactId: string,
  input: Partial<{
    name: string;
    phone: string;
    relationship: string;
    isEmergencyContact: boolean;
    notificationPreferences: string[];
  }>,
) {
  const contact = await TrustedContact.findById(contactId);
  if (!contact) throw new AppError('Contact not found.', 404, ErrorCode.NOT_FOUND);
  await assertHomeCapability(customerId, contact.homeId.toString(), HomeCapability.HOME_EDIT);
  if (input.name) contact.name = input.name;
  if (input.phone) contact.phone = input.phone;
  if (input.relationship !== undefined) contact.relationship = input.relationship;
  if (input.isEmergencyContact !== undefined) contact.isEmergencyContact = input.isEmergencyContact;
  if (input.notificationPreferences) contact.notificationPreferences = input.notificationPreferences;
  await contact.save();
  return { id: contact._id.toString(), name: contact.name };
}

export async function deleteTrustedContact(customerId: string, contactId: string) {
  const contact = await TrustedContact.findById(contactId);
  if (!contact) throw new AppError('Contact not found.', 404, ErrorCode.NOT_FOUND);
  await assertHomeCapability(customerId, contact.homeId.toString(), HomeCapability.HOME_EDIT);
  await contact.deleteOne();
  return { id: contactId, deleted: true };
}

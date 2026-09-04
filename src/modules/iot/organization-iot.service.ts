import { ErrorCode, OrganizationPermission } from '@ghaarfix/shared-types';
import { ConnectedDevice, HomeAlert } from '@/models/IoT.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { AppError } from '@/utils/AppError.js';

export async function listOrganizationDevices(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.MANAGE_PROPERTIES);

  const devices = await ConnectedDevice.find({
    organizationId,
    discoveryStatus: 'APPROVED',
    status: { $ne: 'REMOVED' },
  }).limit(100);

  return devices.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    deviceType: d.deviceType,
    status: d.status,
    managedPropertyId: d.managedPropertyId?.toString(),
    propertyUnitId: d.propertyUnitId?.toString(),
    lastSeenAt: d.lastSeenAt,
  }));
}

export async function listOrganizationAlerts(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.VIEW_ANALYTICS);

  const alerts = await HomeAlert.find({ organizationId }).sort({ createdAt: -1 }).limit(50);
  return alerts.map((a) => ({
    id: a._id.toString(),
    severity: a.severity,
    title: a.title,
    message: a.message,
    status: a.status,
    deviceId: a.deviceId?.toString(),
    createdAt: a.createdAt,
  }));
}

export async function assertOrgDevicePrivacy(
  organizationId: string,
  device: InstanceType<typeof ConnectedDevice>,
) {
  if (device.organizationId?.toString() !== organizationId) {
    throw new AppError('Device not in organization scope.', 403, ErrorCode.FORBIDDEN);
  }
  if (device.propertyUnitId && !device.managedPropertyId) {
    throw new AppError('Tenant device privacy boundary.', 403, ErrorCode.FORBIDDEN);
  }
}

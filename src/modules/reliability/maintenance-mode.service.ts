import { MaintenanceMode } from '@ghaarfix/shared-types';
import { MaintenanceModeConfig } from '@/models/Reliability.js';

export async function getMaintenanceMode(): Promise<{
  mode: MaintenanceMode;
  message?: string;
}> {
  const config = await MaintenanceModeConfig.findOne({ key: 'global' });
  return {
    mode: config?.mode ?? MaintenanceMode.NONE,
    message: config?.message,
  };
}

export async function setMaintenanceMode(
  mode: MaintenanceMode,
  message?: string,
  updatedBy?: string,
): Promise<{ mode: MaintenanceMode; message?: string }> {
  const config = await MaintenanceModeConfig.findOneAndUpdate(
    { key: 'global' },
    { mode, message, updatedBy },
    { upsert: true, new: true },
  );
  return { mode: config.mode, message: config.message };
}

export function isWriteBlocked(mode: MaintenanceMode): boolean {
  return mode === MaintenanceMode.READ_ONLY || mode === MaintenanceMode.FULL;
}

export function isRequestBlocked(mode: MaintenanceMode): boolean {
  return mode === MaintenanceMode.FULL;
}

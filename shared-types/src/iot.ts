/** Phase 16 — Connected Home Intelligence */

export enum IoTProviderType {
  GENERIC_WEBHOOK = 'GENERIC_WEBHOOK',
  MATTER = 'MATTER',
  SMART_HOME_PROVIDER = 'SMART_HOME_PROVIDER',
}

export enum ConnectedDeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN',
  ERROR = 'ERROR',
  REMOVED = 'REMOVED',
}

export enum ConnectedDeviceType {
  WATER_SENSOR = 'WATER_SENSOR',
  LEAK_SENSOR = 'LEAK_SENSOR',
  SMOKE_SENSOR = 'SMOKE_SENSOR',
  TEMPERATURE_SENSOR = 'TEMPERATURE_SENSOR',
  HUMIDITY_SENSOR = 'HUMIDITY_SENSOR',
  POWER_MONITOR = 'POWER_MONITOR',
  AIR_QUALITY_SENSOR = 'AIR_QUALITY_SENSOR',
  HVAC_CONTROLLER = 'HVAC_CONTROLLER',
  SMART_APPLIANCE = 'SMART_APPLIANCE',
  OTHER = 'OTHER',
}

export enum DeviceDiscoveryStatus {
  DISCOVERED = 'DISCOVERED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DeviceAssetLinkRelationship {
  MONITORS = 'MONITORS',
  CONTROLS = 'CONTROLS',
  MEASURES = 'MEASURES',
}

export enum IoTEventSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IoTEventStatus {
  NEW = 'NEW',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

export enum IoTRuleScope {
  HOME = 'HOME',
  ORGANIZATION = 'ORGANIZATION',
  GLOBAL_TEMPLATE = 'GLOBAL_TEMPLATE',
}

export enum IoTRuleActionType {
  SEND_NOTIFICATION = 'SEND_NOTIFICATION',
  CREATE_INSIGHT = 'CREATE_INSIGHT',
  CREATE_ALERT = 'CREATE_ALERT',
  SUGGEST_SERVICE = 'SUGGEST_SERVICE',
  CREATE_URGENT_DRAFT = 'CREATE_URGENT_DRAFT',
  NOTIFY_ORGANIZATION = 'NOTIFY_ORGANIZATION',
}

export enum DeviceHealthLevel {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN',
}

export enum HomeAlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum HomeAlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum HomeAlertSource {
  IOT_EVENT = 'IOT_EVENT',
  RULE_ENGINE = 'RULE_ENGINE',
  PREDICTIVE_MAINTENANCE = 'PREDICTIVE_MAINTENANCE',
  DEVICE_HEALTH = 'DEVICE_HEALTH',
}

export enum IoTConnectionStatus {
  PENDING = 'PENDING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export enum AlertFeedbackType {
  FALSE_ALARM = 'FALSE_ALARM',
  EXPECTED_BEHAVIOR = 'EXPECTED_BEHAVIOR',
  PROBLEM_RESOLVED = 'PROBLEM_RESOLVED',
}

export interface IoTRuleCondition {
  type: 'METRIC_THRESHOLD' | 'EVENT_TYPE' | 'DEVICE_STATUS' | 'DURATION' | 'FREQUENCY' | 'COMPOUND';
  metric?: string;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value?: number | string;
  eventType?: string;
  deviceStatus?: ConnectedDeviceStatus;
  durationMinutes?: number;
  frequencyCount?: number;
  windowMinutes?: number;
  children?: IoTRuleCondition[];
  logic?: 'AND' | 'OR';
}

export interface IoTRuleAction {
  type: IoTRuleActionType;
  config?: Record<string, unknown>;
}

export interface NormalizedIoTEvent {
  externalEventId?: string;
  deviceExternalId: string;
  eventType: string;
  severity: IoTEventSeverity;
  payload: Record<string, unknown>;
  occurredAt: Date;
  dedupeKey: string;
}

export interface TelemetryRecord {
  deviceId: string;
  metric: string;
  value: number;
  unit?: string;
  timestamp: Date;
}

export interface IoTInsight {
  id: string;
  homeId?: string;
  deviceId?: string;
  assetId?: string;
  signal: string;
  possibleReason: string;
  confidence: number;
  recommendedAction: string;
  source: string;
}

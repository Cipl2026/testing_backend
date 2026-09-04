import mongoose, { type Document, Schema, Types } from 'mongoose';
import {
  OperationalRiskEntityType,
  OperationalRiskSeverity,
  OperationalRiskSignalStatus,
  OperationalRiskSignalType,
} from '@ghaarfix/shared-types';

export interface IOperationalRiskSignal extends Document {
  entityType: OperationalRiskEntityType;
  entityId: Types.ObjectId;
  signalType: OperationalRiskSignalType;
  severity: OperationalRiskSeverity;
  status: OperationalRiskSignalStatus;
  details: string;
  metadata?: Record<string, unknown>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNote?: string;
}

const signalSchema = new Schema<IOperationalRiskSignal>(
  {
    entityType: { type: String, enum: Object.values(OperationalRiskEntityType), required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    signalType: { type: String, enum: Object.values(OperationalRiskSignalType), required: true },
    severity: { type: String, enum: Object.values(OperationalRiskSeverity), required: true, index: true },
    status: {
      type: String,
      enum: Object.values(OperationalRiskSignalStatus),
      default: OperationalRiskSignalStatus.NEW,
      index: true,
    },
    details: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    detectedAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: { type: String, maxlength: 500 },
  },
  { timestamps: false },
);

signalSchema.index(
  { entityType: 1, entityId: 1, signalType: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['NEW', 'UNDER_REVIEW'] } } },
);

export const OperationalRiskSignal = mongoose.model<IOperationalRiskSignal>(
  'OperationalRiskSignal',
  signalSchema,
);

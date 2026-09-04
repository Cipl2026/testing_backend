import mongoose, { type Document, Schema, Types } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason: string;
  timestamp: Date;
}

const auditSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', auditSchema);

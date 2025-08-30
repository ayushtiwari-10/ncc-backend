// backend/src/models/AuditLog.js
import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  performedBy: { type: String },
  ip: { type: String },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;

// backend/src/models/Applicant.js
import mongoose from 'mongoose';

const AuditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: String },
    timestamp: { type: Date, default: Date.now },
    meta: { type: Object, default: {} }
  },
  { _id: false }
);

const ApplicantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    uniqueCode: { type: String, required: true, trim: true },
    contactNumber: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], trim: true },
    college: { type: String, trim: true },
    branch: { type: String, trim: true },
    year: { type: Number, min: 1, max: 5 },
    email: { type: String, trim: true, lowercase: true },
    round: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    listName: { type: String, required: true, trim: true },
    auditLogs: { type: [AuditEntrySchema], default: [] },
    marks: {
      Physical: { type: Number, default: 0 },
      GD: { type: Number, default: 0 },
      Interview: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

// Enforce uniqueness per list (not globally)
ApplicantSchema.index({ uniqueCode: 1, listName: 1 }, { unique: true });

const Applicant = mongoose.model('Applicant', ApplicantSchema);
export default Applicant;

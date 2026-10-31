import mongoose, { Schema } from 'mongoose';
const opts = { timestamps: true };
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true, select: false },
    language: { type: String, default: 'en' },
    demo: { type: Boolean, default: false },
  },
  opts,
);
const projectSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, required: true },
    name: String,
    data: Schema.Types.Mixed,
    revision: { type: Number, default: 0 },
    demo: { type: Boolean, default: false },
  },
  opts,
);
const membershipSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, required: true },
    user: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ['owner', 'manager', 'contributor', 'viewer'], required: true },
  },
  opts,
);
membershipSchema.index({ project: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1 });
const recordSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    voided: { type: Boolean, default: false },
    voidReason: String,
  },
  opts,
);
recordSchema.index({ project: 1, kind: 1, 'data.date': -1 });
const vendorSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  opts,
);
vendorSchema.index({ project: 1 });
const sessionSchema = new Schema(
  {
    hash: { type: String, unique: true },
    user: Schema.Types.ObjectId,
    csrf: String,
    expiresAt: Date,
  },
  opts,
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const tokenSchema = new Schema(
  {
    hash: { type: String, unique: true },
    user: Schema.Types.ObjectId,
    email: String,
    project: Schema.Types.ObjectId,
    role: String,
    type: String,
    expiresAt: Date,
  },
  opts,
);
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const attachmentSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, required: true },
    name: String,
    key: String,
    mime: String,
    size: Number,
    createdBy: Schema.Types.ObjectId,
  },
  opts,
);
attachmentSchema.index({ project: 1 });
const auditSchema = new Schema(
  {
    project: Schema.Types.ObjectId,
    user: Schema.Types.ObjectId,
    action: String,
    target: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  opts,
);
auditSchema.index({ project: 1, createdAt: -1 });
const idemSchema = new Schema(
  { project: Schema.Types.ObjectId, key: String, fingerprint: String, result: Schema.Types.Mixed },
  opts,
);
idemSchema.index({ project: 1, key: 1 }, { unique: true });
export const User = mongoose.model('User', userSchema);
export const Project = mongoose.model('Project', projectSchema);
export const Membership = mongoose.model('Membership', membershipSchema);
export const Record = mongoose.model('Record', recordSchema);
export const Vendor = mongoose.model('Vendor', vendorSchema);
export const Session = mongoose.model('Session', sessionSchema);
export const Token = mongoose.model('Token', tokenSchema);
export const Attachment = mongoose.model('Attachment', attachmentSchema);
export const Audit = mongoose.model('Audit', auditSchema);
export const Idempotency = mongoose.model('Idempotency', idemSchema);
export async function connect(uri: string) {
  await mongoose.connect(uri);
  await Promise.all(
    [User, Project, Membership, Record, Vendor, Session, Token, Attachment, Audit, Idempotency].map(
      (m) => m.init(),
    ),
  );
}

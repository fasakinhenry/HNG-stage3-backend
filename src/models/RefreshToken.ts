import mongoose, { Schema } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export interface IRefreshToken {
  _id: string;
  token: string;
  user_id: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    _id:        { type: String, default: () => uuidv7() },
    token:      { type: String, required: true, unique: true },
    user_id:    { type: String, required: true },
    expires_at: { type: Date, required: true },
    revoked:    { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// MongoDB TTL index: auto-deletes documents after expires_at
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// Index for fast lookup and revocation
refreshTokenSchema.index({ user_id: 1 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);

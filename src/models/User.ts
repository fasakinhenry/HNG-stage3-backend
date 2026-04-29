import mongoose, { Schema, Document } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type UserRole = 'admin' | 'analyst';

export interface IUser extends Document {
  id: string;
  github_id: string;
  username: string;
  email: string;
  avatar_url: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    id: {
      type: String,
      default: () => uuidv7(),
      unique: true,
    },
    github_id: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      default: '',
    },
    avatar_url: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'analyst'],
      default: 'analyst',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    last_login_at: {
      type: Date,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
    versionKey: false,
  }
);

// Ensure the virtual 'id' maps to the uuid field in JSON
userSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);

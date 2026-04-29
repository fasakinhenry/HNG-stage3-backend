import mongoose, { Schema } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type UserRole = 'admin' | 'analyst';

// Plain data interface — does NOT extend Document so _id: string is valid
export interface IUser {
  _id: string;
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
    _id: {
      type: String,
      default: () => uuidv7(),
    },
    github_id:     { type: String, required: true, unique: true },
    username:      { type: String, required: true },
    email:         { type: String, default: '' },
    avatar_url:    { type: String, default: '' },
    role:          { type: String, enum: ['admin', 'analyst'], default: 'analyst' },
    is_active:     { type: Boolean, default: true },
    last_login_at: { type: Date, default: null },
    created_at:    { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

export const User = mongoose.model<IUser>('User', userSchema);

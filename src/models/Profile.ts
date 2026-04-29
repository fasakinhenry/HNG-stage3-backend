import mongoose, { Schema, Document } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type AgeGroup = 'child' | 'teenager' | 'adult' | 'senior';

export interface IProfile extends Document {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: AgeGroup;
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: Date;
}

const profileSchema = new Schema<IProfile>(
  {
    id: {
      type: String,
      default: () => uuidv7(),
      unique: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    gender_probability: {
      type: Number,
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    age_group: {
      type: String,
      enum: ['child', 'teenager', 'adult', 'senior'],
      required: true,
    },
    country_id: {
      type: String,
      required: true,
    },
    country_name: {
      type: String,
      required: true,
    },
    country_probability: {
      type: Number,
      required: true,
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

// Indexes for performance
profileSchema.index({ gender: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ age_group: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ created_at: 1 });

profileSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export function getAgeGroup(age: number): AgeGroup {
  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 65) return 'adult';
  return 'senior';
}

export const Profile = mongoose.model<IProfile>('Profile', profileSchema);

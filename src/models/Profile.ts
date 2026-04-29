import mongoose, { Schema } from 'mongoose';
import { v7 as uuidv7 } from 'uuid';

export type AgeGroup = 'child' | 'teenager' | 'adult' | 'senior';

export interface IProfile {
  _id: string;
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
    _id:                 { type: String, default: () => uuidv7() },
    name:                { type: String, required: true, unique: true },
    gender:              { type: String, enum: ['male', 'female'], required: true },
    gender_probability:  { type: Number, required: true },
    age:                 { type: Number, required: true },
    age_group:           { type: String, enum: ['child', 'teenager', 'adult', 'senior'], required: true },
    country_id:          { type: String, required: true },
    country_name:        { type: String, required: true },
    country_probability: { type: Number, required: true },
    created_at:          { type: Date, default: Date.now },
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

profileSchema.index({ gender: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ age_group: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ created_at: 1 });

export function getAgeGroup(age: number): AgeGroup {
  if (age < 13) return 'child';
  if (age < 18) return 'teenager';
  if (age < 65) return 'adult';
  return 'senior';
}

export const Profile = mongoose.model<IProfile>('Profile', profileSchema);

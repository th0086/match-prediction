import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TeamDocument = HydratedDocument<Team>;

@Schema({ timestamps: true, collection: "teams" })
export class Team {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: false, trim: true })
  country?: string;

  @Prop({ required: false, trim: true })
  iconUrl?: string;

  @Prop({ required: true, default: true, index: true })
  isActive!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
TeamSchema.index({ name: 1 }, { unique: true });
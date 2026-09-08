import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PredictionDocument = HydratedDocument<Prediction>;
export type PredictionStatus = "Locked" | "Won" | "Lost";

@Schema({ timestamps: true, collection: "predictions" })
export class Prediction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  matchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  selectedTeamId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  lockedAt!: Date;

  @Prop({ required: true, enum: ["Locked", "Won", "Lost"], default: "Locked", index: true })
  status!: PredictionStatus;

  @Prop({ required: false })
  settledAt?: Date;

  @Prop({ required: true, min: 0, default: 0 })
  payoutKES!: number;

  @Prop({ required: true, default: false, index: true })
  isAdminInjected!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);
PredictionSchema.index({ userId: 1, matchId: 1 });
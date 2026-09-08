import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type MatchDocument = HydratedDocument<Match>;
export type MatchLifecycleStatus = "Open" | "Settled";

@Schema({ timestamps: true, collection: "matches" })
export class Match {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({ type: [Types.ObjectId], required: true })
  teamIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, required: true, index: true })
  splitTabId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  predictionDeadline!: Date;

  @Prop({ required: true, default: true, index: true })
  isPublished!: boolean;

  @Prop({ required: true, enum: ["Open", "Settled"], default: "Open", index: true })
  status!: MatchLifecycleStatus;

  @Prop({ type: Types.ObjectId, required: false })
  winningTeamId?: Types.ObjectId;

  @Prop({ required: false })
  settledAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);
MatchSchema.index({ predictionDeadline: 1, isPublished: 1 });
MatchSchema.index({ splitTabId: 1, predictionDeadline: 1, isPublished: 1 });
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { DEFAULT_BET_ALLOWANCE_LEVELS } from "./bet-allowance-levels";

export type AdminConfigDocument = HydratedDocument<AdminConfig>;

@Schema({ timestamps: true, collection: "admin_configs" })
export class AdminConfig {
  @Prop({ required: true, unique: true, default: "runtime" })
  key!: string;

  @Prop({ required: true, default: "dQw4w9WgXcQ" })
  youtubeVideoId!: string;

  @Prop({ required: true, default: false })
  liveOverlayEnabled!: boolean;

  @Prop({ required: true, default: "polling" })
  realtimeMode!: string;

  @Prop({ required: true, default: 5 })
  pollingIntervalSeconds!: number;

  @Prop({ required: true, default: 123 })
  jackpotIncrementAmount!: number;

  @Prop({ required: true, default: "1234" })
  dataPin!: string;

  @Prop({ type: Array, required: true, default: () => DEFAULT_BET_ALLOWANCE_LEVELS })
  betAllowanceLevels!: Array<{
    level: number;
    depositMin: number;
    betMinExclusive: number;
    grantedChances: number;
  }>;

  @Prop({ type: Array, required: false })
  pendingBetAllowanceLevels?: Array<{
    level: number;
    depositMin: number;
    betMinExclusive: number;
    grantedChances: number;
  }>;

  @Prop({ required: false })
  pendingBetAllowanceEffectiveDayKey?: string;
}

export const AdminConfigSchema = SchemaFactory.createForClass(AdminConfig);
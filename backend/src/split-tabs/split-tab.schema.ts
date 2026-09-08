import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  DEFAULT_SPLIT_TAB_BASE_JACKPOT_AMOUNT_KES,
  DEFAULT_SPLIT_TAB_INVITE_AMOUNT_KES,
} from "./split-tab.constants";

export type SplitTabDocument = HydratedDocument<SplitTab>;

@Schema({ timestamps: true, collection: "split_tabs" })
export class SplitTab {
  @Prop({ required: true, trim: true, unique: true })
  name!: string;

  @Prop({ required: true, min: 0, default: DEFAULT_SPLIT_TAB_BASE_JACKPOT_AMOUNT_KES })
  baseJackpotAmountKES!: number;

  @Prop({ required: true, min: 0, default: DEFAULT_SPLIT_TAB_INVITE_AMOUNT_KES })
  inviteAmountKES!: number;

  @Prop({ required: true, default: false })
  fixedPredictionModeEnabled!: boolean;

  @Prop({ required: false, min: 0 })
  fixedPredictionCount?: number;

  @Prop({ required: true, default: true })
  isEnabled!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SplitTabSchema = SchemaFactory.createForClass(SplitTab);
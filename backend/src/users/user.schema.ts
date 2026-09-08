import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class SplitTabFixedAllowanceUsage {
  @Prop({ type: Types.ObjectId, required: true })
  splitTabId!: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  usedCount!: number;
}

export const SplitTabFixedAllowanceUsageSchema = SchemaFactory.createForClass(SplitTabFixedAllowanceUsage);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, default: "local", enum: ["local", "external"] })
  authProvider!: "local" | "external";

  @Prop({ required: true, default: true })
  localPasswordEnabled!: boolean;

  @Prop({ default: "player", enum: ["player", "admin", "super_admin", "data_admin"] })
  role!: "player" | "admin" | "super_admin" | "data_admin";

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ required: true, default: 0, min: 0 })
  walletBalanceKES!: number;

  @Prop({ required: true, default: "KES" })
  walletCurrency!: string;

  @Prop({ required: false })
  externalMerchant?: string;

  @Prop({ required: false })
  externalToken?: string;

  @Prop({ required: false })
  externalRef?: string;

  @Prop({ required: false, default: "0.00" })
  depositAmount?: string;

  @Prop({ required: false, default: "0.00" })
  betAmount?: string;

  @Prop({ required: false })
  dailyBetAllowanceDayKey?: string;

  @Prop({ required: true, default: 0, min: 0 })
  dailyBetAllowanceTotal!: number;

  @Prop({ required: true, default: 0, min: 0 })
  dailyBetAllowanceUsed!: number;

  @Prop({ required: true, default: 0, min: 0 })
  dailyBetAllowanceHighestGranted!: number;

  @Prop({ required: true, default: 0, min: 0 })
  inviteSuccessCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  inviteRewardGrantedCount!: number;

  @Prop({ required: true, default: false })
  signupBaseChanceGranted!: boolean;

  @Prop({ type: [SplitTabFixedAllowanceUsageSchema], default: [] })
  splitTabFixedAllowanceUsages!: SplitTabFixedAllowanceUsage[];

  @Prop({ required: false })
  externalLoggedInAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { phone: 1 },
  {
    name: "uniq_local_phone",
    unique: true,
    partialFilterExpression: { authProvider: "local" },
  },
);

UserSchema.index(
  { phone: 1, externalMerchant: 1 },
  {
    name: "uniq_external_phone_merchant",
    unique: true,
    partialFilterExpression: { authProvider: "external" },
  },
);

import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { AdminConfig, AdminConfigDocument } from "../admin/admin-config.schema";
import { BetAllowanceLevel, DEFAULT_BET_ALLOWANCE_LEVELS } from "../admin/bet-allowance-levels";
import { InviteStatusQueryDto } from "../admin/admin.dto";
import { CallbackResponse } from "../callbacks/callback.service";
import { JackpotState, JackpotStateDocument } from "../draws/jackpot-state.schema";
import { DrawnNumber, DrawnNumberDocument } from "../draws/drawn-number.schema";
import { buildPredictionJackpotScope, JACKPOT_CURRENCY } from "../split-tabs/split-tab.constants";
import { SplitTab, SplitTabDocument } from "../split-tabs/split-tab.schema";
import { User, UserDocument } from "./user.schema";

const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 (Africa/Nairobi)
const SUPER_ADMIN_DEFAULT_PERMISSIONS = ["admin:access", "draw:manage", "live:manage", "users:read", "data:read"];
const DATA_ADMIN_DEFAULT_PERMISSIONS = ["data:read"];

export type DailyBetAllowanceSnapshot = {
  dayKey: string;
  total: number;
  used: number;
  remaining: number;
  highestGranted: number;
};

export type ConsumeDailyBetAllowanceResult = {
  ok: boolean;
  snapshot: DailyBetAllowanceSnapshot;
};

export type SplitTabAllowanceSnapshot = {
  splitTabId: string;
  total: number;
  used: number;
  remaining: number;
  mode: "fixed" | "shared";
  fixedPredictionModeEnabled: boolean;
};

function toKenyaDayKey(date: Date): string {
  return new Date(date.getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}

function parseAmount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeEligibleDailyAllowance(
  depositAmount: number,
  betAmount: number,
  levels: BetAllowanceLevel[],
): number {
  let maxGranted = 0;

  for (const level of levels) {
    if (depositAmount >= level.depositMin && betAmount >= level.betMinExclusive) {
      maxGranted = Math.max(maxGranted, level.grantedChances);
    }
  }

  return maxGranted;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly configKey = "runtime";

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(DrawnNumber.name) private readonly drawnNumberModel: Model<DrawnNumberDocument>,
    @InjectModel(JackpotState.name) private readonly jackpotStateModel: Model<JackpotStateDocument>,
    @InjectModel(AdminConfig.name) private readonly adminConfigModel: Model<AdminConfigDocument>,
    @InjectModel(SplitTab.name) private readonly splitTabModel: Model<SplitTabDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const strictMode =
      (this.configService.get<string>("BOOTSTRAP_STRICT_MODE") ?? "false") === "true";

    try {
      await this.ensureUserIndexes();
      await this.ensureSuperAdmin();
      await this.ensureDataAdmin();
    } catch (error) {
      if (strictMode) {
        throw error;
      }

      // In lax mode, backend startup continues even if bootstrap checks fail.
      console.warn("[UsersService] Super admin bootstrap skipped:", error);
    }
  }

  async ensureSuperAdmin(): Promise<void> {
    const existingSuperAdmin = await this.userModel.findOne({ role: "super_admin" });
    if (existingSuperAdmin) {
      const mergedPermissions = Array.from(new Set([...(existingSuperAdmin.permissions ?? []), ...SUPER_ADMIN_DEFAULT_PERMISSIONS]));
      if (mergedPermissions.length !== (existingSuperAdmin.permissions ?? []).length) {
        existingSuperAdmin.permissions = mergedPermissions;
        await existingSuperAdmin.save();
      }
      return;
    }

    const phone = this.configService.get<string>("SUPER_ADMIN_PHONE") ?? "+254700000001";
    const password = this.configService.get<string>("SUPER_ADMIN_PASSWORD") ?? "ChangeMe123!";

    const passwordHash = await bcrypt.hash(password, 10);

    await this.userModel.create({
      phone,
      passwordHash,
      authProvider: "local",
      localPasswordEnabled: true,
      role: "super_admin",
      permissions: SUPER_ADMIN_DEFAULT_PERMISSIONS,
      walletBalanceKES: 0,
      walletCurrency: "KES",
      depositAmount: "0.00",
      betAmount: "0.00",
      dailyBetAllowanceTotal: 0,
      dailyBetAllowanceUsed: 0,
      dailyBetAllowanceHighestGranted: 0,
      inviteSuccessCount: 0,
      inviteRewardGrantedCount: 0,
      signupBaseChanceGranted: false,
    });
  }

  async ensureDataAdmin(): Promise<void> {
    const phone = this.configService.get<string>("DATA_ADMIN_PHONE") ?? "+254700000002";
    const password = this.configService.get<string>("DATA_ADMIN_PASSWORD") ?? "Alan0922318405";

    const existingByPhone = await this.userModel.findOne({ phone, authProvider: "local" });
    if (existingByPhone) {
      const mergedPermissions = Array.from(new Set([...(existingByPhone.permissions ?? []), ...DATA_ADMIN_DEFAULT_PERMISSIONS]));
      const needsRoleUpdate = existingByPhone.role !== "data_admin";
      const needsPermissionUpdate = mergedPermissions.length !== (existingByPhone.permissions ?? []).length;

      if (needsRoleUpdate || needsPermissionUpdate) {
        existingByPhone.role = "data_admin";
        existingByPhone.permissions = mergedPermissions;
        await existingByPhone.save();
      }

      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.userModel.create({
      phone,
      passwordHash,
      authProvider: "local",
      localPasswordEnabled: true,
      role: "data_admin",
      permissions: DATA_ADMIN_DEFAULT_PERMISSIONS,
      walletBalanceKES: 0,
      walletCurrency: "KES",
      depositAmount: "0.00",
      betAmount: "0.00",
      dailyBetAllowanceTotal: 0,
      dailyBetAllowanceUsed: 0,
      dailyBetAllowanceHighestGranted: 0,
      inviteSuccessCount: 0,
      inviteRewardGrantedCount: 0,
      signupBaseChanceGranted: false,
    });
  }

  async findById(userId: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }
    return this.userModel.findById(new Types.ObjectId(userId));
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone, authProvider: "local" });
  }

  async findExternalByPhoneAndMerchant(phone: string, merchant: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      phone,
      authProvider: "external",
      externalMerchant: merchant,
    });
  }

  async createPlayer(phone: string, password: string): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.userModel.create({
      phone,
      passwordHash,
      authProvider: "local",
      localPasswordEnabled: true,
      role: "player",
      permissions: [],
      walletBalanceKES: 0,
      walletCurrency: "KES",
      depositAmount: "0.00",
      betAmount: "0.00",
      dailyBetAllowanceTotal: 0,
      dailyBetAllowanceUsed: 0,
      dailyBetAllowanceHighestGranted: 0,
      inviteSuccessCount: 0,
      inviteRewardGrantedCount: 0,
      signupBaseChanceGranted: false,
    });
  }

  async createExternalPlayer(phone: string, merchant: string): Promise<UserDocument> {
    const placeholderPassword = randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(placeholderPassword, 10);

    return this.userModel.create({
      phone,
      passwordHash,
      authProvider: "external",
      localPasswordEnabled: false,
      externalMerchant: merchant,
      role: "player",
      permissions: [],
      walletBalanceKES: 0,
      walletCurrency: "KES",
      depositAmount: "0.00",
      betAmount: "0.00",
      dailyBetAllowanceTotal: 0,
      dailyBetAllowanceUsed: 0,
      dailyBetAllowanceHighestGranted: 0,
      inviteSuccessCount: 0,
      inviteRewardGrantedCount: 0,
      signupBaseChanceGranted: false,
    });
  }

  async recordInviteSuccessByPhone(phone: string, merchant: string): Promise<{
    found: boolean;
    rewardGranted: boolean;
    inviteSuccessCount: number;
    inviteRewardGrantedCount: number;
    jackpotIncrementKES: number;
    jackpotAmountKES: number | null;
    splitTabJackpots: Array<{ splitTabId: string; name: string; jackpotIncrementKES: number; jackpotAmountKES: number }>;
  }> {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      return {
        found: false,
        rewardGranted: false,
        inviteSuccessCount: 0,
        inviteRewardGrantedCount: 0,
        jackpotIncrementKES: 0,
        jackpotAmountKES: null,
        splitTabJackpots: [],
      };
    }

    const normalizedMerchant = merchant.trim().toLowerCase();
    const user = await this.userModel.findOne({
      phone: normalizedPhone,
      authProvider: "external",
      externalMerchant: normalizedMerchant,
    });
    if (!user) {
      return {
        found: false,
        rewardGranted: false,
        inviteSuccessCount: 0,
        inviteRewardGrantedCount: 0,
        jackpotIncrementKES: 0,
        jackpotAmountKES: null,
        splitTabJackpots: [],
      };
    }

    const dayKey = toKenyaDayKey(new Date());
    const reset = await this.resetDailyAllowanceStateIfNeeded(user, dayKey);
    const grantedBaseChance = this.ensureSignupBaseChance(user);

    user.inviteSuccessCount = Math.max(0, (user.inviteSuccessCount ?? 0) + 1);

    let rewardGranted = false;
    const grantedCount = Math.max(0, user.inviteRewardGrantedCount ?? 0);
    if (grantedCount < 5) {
      user.inviteRewardGrantedCount = grantedCount + 1;
      user.dailyBetAllowanceTotal = Math.max(0, (user.dailyBetAllowanceTotal ?? 0) + 1);
      rewardGranted = true;
    }

    if (reset || grantedBaseChance || rewardGranted || user.isModified("inviteSuccessCount")) {
      await user.save();
    }

    const splitTabJackpots = rewardGranted ? await this.incrementJackpotsByInviteReward() : [];
    const jackpotAmountKES = splitTabJackpots[0]?.jackpotAmountKES ?? null;
    const jackpotIncrementKES = splitTabJackpots.reduce((sum, item) => sum + item.jackpotIncrementKES, 0);

    return {
      found: true,
      rewardGranted,
      inviteSuccessCount: Math.max(0, user.inviteSuccessCount ?? 0),
      inviteRewardGrantedCount: Math.max(0, user.inviteRewardGrantedCount ?? 0),
      jackpotIncrementKES,
      jackpotAmountKES,
      splitTabJackpots,
    };
  }

  async getSplitTabAllowanceSnapshots(userId: string): Promise<SplitTabAllowanceSnapshot[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) {
      return [];
    }

    const dayKey = toKenyaDayKey(new Date());
    const reset = await this.resetDailyAllowanceStateIfNeeded(user, dayKey);
    const grantedBaseChance = this.ensureSignupBaseChance(user);
    if (reset || grantedBaseChance) {
      await user.save();
    }

    const splitTabs = await this.splitTabModel.find().sort({ createdAt: 1, _id: 1 }).lean();
    return splitTabs.map((splitTab) => this.buildSplitTabAllowanceSnapshot(user, splitTab, dayKey));
  }

  async upsertExternalLoginToken(userId: string, merchant: string, token: string, ref?: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      return;
    }

    const setPayload: {
      externalMerchant: string;
      externalToken: string;
      externalLoggedInAt: Date;
      externalRef?: string;
    } = {
      externalMerchant: merchant,
      externalToken: token,
      externalLoggedInAt: new Date(),
    };

    if (ref) {
      setPayload.externalRef = ref;
    }

    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: setPayload,
      },
    );
  }

  private async ensureUserIndexes(): Promise<void> {
    const indexes = await this.userModel.collection.indexes();
    const legacyUniquePhoneIndex = indexes.find(
      (index) => index.name === "phone_1" && index.unique,
    );

    if (legacyUniquePhoneIndex?.name) {
      await this.userModel.collection.dropIndex(legacyUniquePhoneIndex.name);
    }

    await this.userModel.collection.createIndex(
      { phone: 1 },
      {
        name: "uniq_local_phone",
        unique: true,
        partialFilterExpression: { authProvider: "local" },
      },
    );

    await this.userModel.collection.createIndex(
      { phone: 1, externalMerchant: 1 },
      {
        name: "uniq_external_phone_merchant",
        unique: true,
        partialFilterExpression: { authProvider: "external" },
      },
    );
  }

  async applyExternalCallbackProfileUpdate(
    userId: string,
    response: CallbackResponse,
  ): Promise<DailyBetAllowanceSnapshot | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) {
      return null;
    }

    const dayKey = toKenyaDayKey(new Date());
    let changed = await this.resetDailyAllowanceStateIfNeeded(user, dayKey);
    changed = this.ensureSignupBaseChance(user) || changed;

    const depositAmount =
      typeof response.data?.depositAmount === "string" && response.data.depositAmount.trim().length > 0
        ? response.data.depositAmount.trim()
        : undefined;
    const betAmount =
      typeof response.data?.betAmount === "string" && response.data.betAmount.trim().length > 0
        ? response.data.betAmount.trim()
        : undefined;

    if (depositAmount) {
      user.depositAmount = depositAmount;
      changed = true;
    }

    if (betAmount) {
      user.betAmount = betAmount;
      changed = true;
    }

    const currentDepositAmount = parseAmount(user.depositAmount);
    const currentBetAmount = parseAmount(user.betAmount);
    const allowanceLevels = await this.getActiveBetAllowanceLevels(dayKey);
    const eligibleAllowance = computeEligibleDailyAllowance(
      currentDepositAmount,
      currentBetAmount,
      allowanceLevels,
    );
    const currentHighestGranted = Math.max(0, user.dailyBetAllowanceHighestGranted ?? 0);

    if (eligibleAllowance > currentHighestGranted) {
      const increment = eligibleAllowance - currentHighestGranted;
      user.dailyBetAllowanceTotal = Math.max(0, (user.dailyBetAllowanceTotal ?? 0) + increment);
      user.dailyBetAllowanceHighestGranted = eligibleAllowance;
      changed = true;
    }

    if (changed) {
      await user.save();
    }

    return this.buildDailyAllowanceSnapshot(user, dayKey);
  }

  async getDailyBetAllowance(userId: string): Promise<DailyBetAllowanceSnapshot | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) {
      return null;
    }

    const dayKey = toKenyaDayKey(new Date());
    const reset = await this.resetDailyAllowanceStateIfNeeded(user, dayKey);
    const grantedBaseChance = this.ensureSignupBaseChance(user);
    if (reset || grantedBaseChance) {
      await user.save();
    }

    return this.buildDailyAllowanceSnapshot(user, dayKey);
  }

  async consumeDailyBetAllowance(userId: string): Promise<ConsumeDailyBetAllowanceResult | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    const user = await this.userModel.findById(new Types.ObjectId(userId));
    if (!user) {
      return null;
    }

    const dayKey = toKenyaDayKey(new Date());
    const reset = await this.resetDailyAllowanceStateIfNeeded(user, dayKey);
    const grantedBaseChance = this.ensureSignupBaseChance(user);
    const currentTotal = Math.max(0, user.dailyBetAllowanceTotal ?? 0);
    const currentUsed = Math.max(0, user.dailyBetAllowanceUsed ?? 0);

    if (currentUsed >= currentTotal) {
      if (reset || grantedBaseChance) {
        await user.save();
      }
      return {
        ok: false,
        snapshot: this.buildDailyAllowanceSnapshot(user, dayKey),
      };
    }

    user.dailyBetAllowanceUsed = currentUsed + 1;
    await user.save();

    return {
      ok: true,
      snapshot: this.buildDailyAllowanceSnapshot(user, dayKey),
    };
  }

  async consumePredictionAllowance(
    userId: string,
    splitTab: { splitTabId: string; fixedPredictionModeEnabled: boolean; fixedPredictionCount: number | null },
  ): Promise<ConsumeDailyBetAllowanceResult | null> {
    if (!splitTab.fixedPredictionModeEnabled) {
      return this.consumeDailyBetAllowance(userId);
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(splitTab.splitTabId)) {
      return null;
    }

    const userObjectId = new Types.ObjectId(userId);
    const splitTabObjectId = new Types.ObjectId(splitTab.splitTabId);
    const total = Math.max(0, splitTab.fixedPredictionCount ?? 0);
    if (total <= 0) {
      return {
        ok: false,
        snapshot: {
          dayKey: "fixed",
          total,
          used: 0,
          remaining: 0,
          highestGranted: total,
        },
      };
    }

    let consumed = false;
    const incrementExisting = await this.userModel.updateOne(
      {
        _id: userObjectId,
        splitTabFixedAllowanceUsages: {
          $elemMatch: {
            splitTabId: splitTabObjectId,
            usedCount: { $lt: total },
          },
        },
      },
      {
        $inc: {
          "splitTabFixedAllowanceUsages.$.usedCount": 1,
        },
      },
    );
    consumed = incrementExisting.modifiedCount > 0;

    if (!consumed) {
      const createUsage = await this.userModel.updateOne(
        {
          _id: userObjectId,
          "splitTabFixedAllowanceUsages.splitTabId": { $ne: splitTabObjectId },
        },
        {
          $push: {
            splitTabFixedAllowanceUsages: {
              splitTabId: splitTabObjectId,
              usedCount: 1,
            },
          },
        },
      );
      consumed = createUsage.modifiedCount > 0;
    }

    if (!consumed) {
      const retryIncrementExisting = await this.userModel.updateOne(
        {
          _id: userObjectId,
          splitTabFixedAllowanceUsages: {
            $elemMatch: {
              splitTabId: splitTabObjectId,
              usedCount: { $lt: total },
            },
          },
        },
        {
          $inc: {
            "splitTabFixedAllowanceUsages.$.usedCount": 1,
          },
        },
      );
      consumed = retryIncrementExisting.modifiedCount > 0;
    }

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      return null;
    }

    const usage = this.findSplitTabFixedAllowanceUsage(user, splitTab.splitTabId);
    const used = Math.max(0, usage?.usedCount ?? 0);

    return {
      ok: consumed,
      snapshot: {
        dayKey: "fixed",
        total,
        used,
        remaining: Math.max(0, total - used),
        highestGranted: total,
      },
    };
  }

  async getInviteStats(query: InviteStatusQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const normalizedPhone = query.phone?.trim();

    const condition: { phone?: { $regex: string; $options: "i" } } = {};
    if (normalizedPhone) {
      condition.phone = {
        $regex: this.escapeRegex(normalizedPhone),
        $options: "i",
      };
    }

    const [total, users] = await Promise.all([
      this.userModel.countDocuments(condition),
      this.userModel
        .find(condition)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);

    return {
      total,
      limit,
      offset,
      items: users.map((user) => ({
        userId: String(user._id),
        phone: user.phone,
        predictionChances: Math.max(0, user.dailyBetAllowanceTotal ?? 0),
        usedPredictionChances: Math.max(0, user.dailyBetAllowanceUsed ?? 0),
        validInviteCount: Math.max(0, user.inviteRewardGrantedCount ?? 0),
        totalSuccessfulInviteCount: Math.max(0, user.inviteSuccessCount ?? 0),
      })),
    };
  }

  async buildInviteStatsCsv(query: InviteStatusQueryDto) {
    const payload = await this.getInviteStats({
      ...query,
      limit: 5000,
      offset: 0,
    });

    const header = [
      "phone",
      "predictionChances",
      "usedPredictionChances",
      "validInviteCount",
      "totalSuccessfulInviteCount",
      "userId",
    ];
    const lines = [header.join(",")];

    for (const item of payload.items) {
      lines.push([
        item.phone,
        String(item.predictionChances),
        String(item.usedPredictionChances),
        String(item.validInviteCount),
        String(item.totalSuccessfulInviteCount),
        item.userId,
      ].map((value) => this.escapeCsv(value)).join(","));
    }

    return lines.join("\n");
  }

  private async resetDailyAllowanceStateIfNeeded(user: UserDocument, dayKey: string): Promise<boolean> {
    const currentDayKey = user.dailyBetAllowanceDayKey;
    if (currentDayKey === dayKey) {
      return false;
    }

    // Keep allowance balances across day boundaries; only advance tracking key.
    user.dailyBetAllowanceDayKey = dayKey;
    return true;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async incrementJackpotsByInviteReward() {
    const now = new Date();
    const splitTabs = await this.splitTabModel.find().sort({ createdAt: 1, _id: 1 }).lean();
    const results: Array<{ splitTabId: string; name: string; jackpotIncrementKES: number; jackpotAmountKES: number }> = [];

    for (const splitTab of splitTabs) {
      const scope = buildPredictionJackpotScope(String(splitTab._id));
      await this.jackpotStateModel.updateOne(
        { scope },
        {
          $setOnInsert: {
            scope,
            currentAmountKES: splitTab.baseJackpotAmountKES,
            currency: JACKPOT_CURRENCY,
            lastAccumulatedAt: now,
          },
        },
        { upsert: true },
      );

      const jackpot = await this.jackpotStateModel.findOneAndUpdate(
        { scope },
        { $inc: { currentAmountKES: splitTab.inviteAmountKES } },
        { new: true },
      );

      results.push({
        splitTabId: String(splitTab._id),
        name: splitTab.name,
        jackpotIncrementKES: splitTab.inviteAmountKES,
        jackpotAmountKES: jackpot?.currentAmountKES ?? splitTab.baseJackpotAmountKES,
      });
    }

    return results;
  }

  private escapeCsv(value: string | number) {
    const stringValue = String(value ?? "");
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private ensureSignupBaseChance(user: UserDocument): boolean {
    if (user.signupBaseChanceGranted) {
      return false;
    }

    user.signupBaseChanceGranted = true;
    user.dailyBetAllowanceTotal = Math.max(0, (user.dailyBetAllowanceTotal ?? 0) + 1);
    return true;
  }

  private buildDailyAllowanceSnapshot(user: UserDocument, dayKey: string): DailyBetAllowanceSnapshot {
    const total = Math.max(0, user.dailyBetAllowanceTotal ?? 0);
    const used = Math.max(0, user.dailyBetAllowanceUsed ?? 0);
    const remaining = Math.max(0, total - used);
    const highestGranted = Math.max(0, user.dailyBetAllowanceHighestGranted ?? 0);

    return {
      dayKey,
      total,
      used,
      remaining,
      highestGranted,
    };
  }

  private buildSplitTabAllowanceSnapshot(
    user: UserDocument,
    splitTab: Pick<SplitTabDocument, "_id" | "fixedPredictionModeEnabled" | "fixedPredictionCount">,
    dayKey: string,
  ): SplitTabAllowanceSnapshot {
    if (!splitTab.fixedPredictionModeEnabled) {
      const shared = this.buildDailyAllowanceSnapshot(user, dayKey);
      return {
        splitTabId: String(splitTab._id),
        total: shared.total,
        used: shared.used,
        remaining: shared.remaining,
        mode: "shared",
        fixedPredictionModeEnabled: false,
      };
    }

    const total = Math.max(0, splitTab.fixedPredictionCount ?? 0);
    const usage = this.findSplitTabFixedAllowanceUsage(user, String(splitTab._id));
    const used = Math.max(0, usage?.usedCount ?? 0);
    return {
      splitTabId: String(splitTab._id),
      total,
      used,
      remaining: Math.max(0, total - used),
      mode: "fixed",
      fixedPredictionModeEnabled: true,
    };
  }

  private findSplitTabFixedAllowanceUsage(user: UserDocument, splitTabId: string) {
    return (user.splitTabFixedAllowanceUsages ?? []).find((entry) => String(entry.splitTabId) === splitTabId);
  }

  private getOrCreateSplitTabFixedAllowanceUsage(user: UserDocument, splitTabId: string) {
    const existing = this.findSplitTabFixedAllowanceUsage(user, splitTabId);
    if (existing) {
      return existing;
    }

    const created = {
      splitTabId: new Types.ObjectId(splitTabId),
      usedCount: 0,
    };
    user.splitTabFixedAllowanceUsages = [...(user.splitTabFixedAllowanceUsages ?? []), created];
    return created;
  }

  private async getActiveBetAllowanceLevels(dayKey: string): Promise<BetAllowanceLevel[]> {
    const config = await this.adminConfigModel.findOne({ key: this.configKey }).lean();
    if (!config) {
      return DEFAULT_BET_ALLOWANCE_LEVELS;
    }

    const currentLevels =
      Array.isArray(config.betAllowanceLevels) && config.betAllowanceLevels.length === 6
        ? config.betAllowanceLevels
        : DEFAULT_BET_ALLOWANCE_LEVELS;
    const pendingLevels =
      Array.isArray(config.pendingBetAllowanceLevels) && config.pendingBetAllowanceLevels.length === 6
        ? config.pendingBetAllowanceLevels
        : null;
    const pendingEffectiveDayKey =
      typeof config.pendingBetAllowanceEffectiveDayKey === "string"
        ? config.pendingBetAllowanceEffectiveDayKey
        : null;

    if (pendingLevels && pendingEffectiveDayKey && dayKey >= pendingEffectiveDayKey) {
      return pendingLevels;
    }

    return currentLevels;
  }

  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    if (!user.localPasswordEnabled) {
      return false;
    }

    if (!user.passwordHash) {
      return false;
    }

    return bcrypt.compare(password, user.passwordHash);
  }
}

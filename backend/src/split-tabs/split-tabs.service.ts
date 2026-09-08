import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { JackpotState, JackpotStateDocument } from "../draws/jackpot-state.schema";
import { Match, MatchDocument } from "../matches/match.schema";
import {
  buildPredictionJackpotScope,
  DEFAULT_SPLIT_TAB_BASE_JACKPOT_AMOUNT_KES,
  DEFAULT_SPLIT_TAB_INVITE_AMOUNT_KES,
  DEFAULT_SPLIT_TAB_NAME,
  JACKPOT_CURRENCY,
  LEGACY_DEFAULT_SPLIT_TAB_NAME,
} from "./split-tab.constants";
import { SplitTab, SplitTabDocument } from "./split-tab.schema";

type SplitTabMutation = {
  name?: string;
  baseJackpotAmountKES?: number;
  inviteAmountKES?: number;
  fixedPredictionModeEnabled?: boolean;
  fixedPredictionCount?: number;
  isEnabled?: boolean;
};

@Injectable()
export class SplitTabsService implements OnModuleInit {
  constructor(
    @InjectModel(SplitTab.name) private readonly splitTabModel: Model<SplitTabDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(JackpotState.name) private readonly jackpotStateModel: Model<JackpotStateDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultChampionTab();
  }

  async listAll() {
    const tabs = await this.splitTabModel.find().sort({ createdAt: 1, _id: 1 }).lean();
    return tabs.map((tab) => this.toDto(tab));
  }

  async create(dto: SplitTabMutation) {
    const payload = this.normalizeMutation(dto, true);
    const duplicate = await this.splitTabModel.findOne({ name: payload.name }).lean();
    if (duplicate) {
      throw new BadRequestException("Split tab name already exists.");
    }

    const created = await this.splitTabModel.create(payload);
    return this.toDto(created.toObject());
  }

  async update(splitTabId: string, dto: SplitTabMutation) {
    if (!Types.ObjectId.isValid(splitTabId)) {
      throw new BadRequestException("Invalid split tab id.");
    }

    const tab = await this.splitTabModel.findById(new Types.ObjectId(splitTabId));
    if (!tab) {
      throw new BadRequestException("Split tab not found.");
    }

    const payload = this.normalizeMutation(dto, false);
    if (typeof payload.name === "string") {
      const duplicate = await this.splitTabModel.findOne({ _id: { $ne: tab._id }, name: payload.name }).lean();
      if (duplicate) {
        throw new BadRequestException("Split tab name already exists.");
      }
      tab.name = payload.name;
    }
    if (typeof payload.baseJackpotAmountKES === "number") {
      tab.baseJackpotAmountKES = payload.baseJackpotAmountKES;
    }
    if (typeof payload.inviteAmountKES === "number") {
      tab.inviteAmountKES = payload.inviteAmountKES;
    }
    if (typeof payload.fixedPredictionModeEnabled === "boolean") {
      tab.fixedPredictionModeEnabled = payload.fixedPredictionModeEnabled;
    }
    if (payload.fixedPredictionModeEnabled === false) {
      tab.fixedPredictionCount = undefined;
    } else if (typeof payload.fixedPredictionCount === "number") {
      tab.fixedPredictionCount = payload.fixedPredictionCount;
    }
    if (typeof payload.isEnabled === "boolean") {
      tab.isEnabled = payload.isEnabled;
    }

    await tab.save();
    return this.toDto(tab.toObject());
  }

  async delete(splitTabId: string) {
    if (!Types.ObjectId.isValid(splitTabId)) {
      throw new BadRequestException("Invalid split tab id.");
    }

    const totalTabs = await this.splitTabModel.countDocuments();
    if (totalTabs <= 1) {
      throw new BadRequestException("At least one split tab must remain.");
    }

    const splitTabObjectId = new Types.ObjectId(splitTabId);
    const usageCount = await this.matchModel.countDocuments({ splitTabId: splitTabObjectId });
    if (usageCount > 0) {
      throw new BadRequestException("Split tab is still used by matches and cannot be deleted.");
    }

    const result = await this.splitTabModel.deleteOne({ _id: splitTabObjectId });
    if ((result.deletedCount ?? 0) === 0) {
      throw new BadRequestException("Split tab not found.");
    }

    await this.jackpotStateModel.deleteOne({ scope: buildPredictionJackpotScope(splitTabId) });
    return { deleted: true, splitTabId };
  }

  private async ensureDefaultChampionTab() {
    let champion = await this.splitTabModel.findOne({ name: DEFAULT_SPLIT_TAB_NAME });
    if (!champion) {
      champion = await this.splitTabModel.findOne({ name: LEGACY_DEFAULT_SPLIT_TAB_NAME });
      if (champion) {
        champion.name = DEFAULT_SPLIT_TAB_NAME;
        await champion.save();
      }
    }

    if (!champion) {
      champion = await this.splitTabModel.create({
        name: DEFAULT_SPLIT_TAB_NAME,
        baseJackpotAmountKES: DEFAULT_SPLIT_TAB_BASE_JACKPOT_AMOUNT_KES,
        inviteAmountKES: DEFAULT_SPLIT_TAB_INVITE_AMOUNT_KES,
        fixedPredictionModeEnabled: false,
        isEnabled: true,
      });
    }

    await this.splitTabModel.updateMany(
      { isEnabled: { $exists: false } },
      { $set: { isEnabled: true } },
    );

    await this.matchModel.updateMany(
      { $or: [{ splitTabId: { $exists: false } }, { splitTabId: null }] },
      { $set: { splitTabId: champion._id } },
    );

    const championScope = buildPredictionJackpotScope(String(champion._id));
    const legacyGlobalJackpot = await this.jackpotStateModel.findOne({ scope: "global" });
    const existingChampionJackpot = await this.jackpotStateModel.findOne({ scope: championScope });

    if (legacyGlobalJackpot && !existingChampionJackpot) {
      legacyGlobalJackpot.scope = championScope;
      legacyGlobalJackpot.currency = legacyGlobalJackpot.currency || JACKPOT_CURRENCY;
      if (legacyGlobalJackpot.currentAmountKES < champion.baseJackpotAmountKES) {
        legacyGlobalJackpot.currentAmountKES = champion.baseJackpotAmountKES;
      }
      await legacyGlobalJackpot.save();
      return;
    }

    if (!existingChampionJackpot) {
      await this.jackpotStateModel.create({
        scope: championScope,
        currentAmountKES: champion.baseJackpotAmountKES,
        currency: JACKPOT_CURRENCY,
        lastAccumulatedAt: new Date(),
      });
    }
  }

  private normalizeMutation(dto: SplitTabMutation, requireAll: boolean) {
    const payload: SplitTabMutation = {};

    if (requireAll || typeof dto.name === "string") {
      const name = dto.name?.trim() ?? "";
      if (!name) {
        throw new BadRequestException("Split tab name is required.");
      }
      payload.name = name;
    }

    if (requireAll || typeof dto.baseJackpotAmountKES === "number") {
      const amount = Math.max(0, Math.floor(dto.baseJackpotAmountKES ?? -1));
      if (!Number.isFinite(amount)) {
        throw new BadRequestException("Split tab jackpot amount is invalid.");
      }
      payload.baseJackpotAmountKES = amount;
    }

    if (requireAll || typeof dto.inviteAmountKES === "number") {
      const amount = Math.max(0, Math.floor(dto.inviteAmountKES ?? -1));
      if (!Number.isFinite(amount)) {
        throw new BadRequestException("Split tab invite amount is invalid.");
      }
      payload.inviteAmountKES = amount;
    }

    if (requireAll || typeof dto.fixedPredictionModeEnabled === "boolean") {
      if (typeof dto.fixedPredictionModeEnabled !== "boolean") {
        throw new BadRequestException("Split tab fixed prediction mode flag is required.");
      }
      payload.fixedPredictionModeEnabled = dto.fixedPredictionModeEnabled;
    }

    const fixedModeEnabled = payload.fixedPredictionModeEnabled ?? dto.fixedPredictionModeEnabled;
    if (fixedModeEnabled) {
      const count = dto.fixedPredictionCount;
      if (typeof count !== "number" || !Number.isFinite(count) || count < 1) {
        throw new BadRequestException("Fixed prediction count is required when fixed mode is enabled.");
      }
      payload.fixedPredictionCount = Math.floor(count);
    }

    if (requireAll || typeof dto.isEnabled === "boolean") {
      if (typeof dto.isEnabled === "boolean") {
        payload.isEnabled = dto.isEnabled;
      } else if (requireAll) {
        payload.isEnabled = true;
      }
    }

    return payload;
  }

  private toDto(tab: SplitTabDocument | (SplitTab & { _id?: Types.ObjectId })) {
    return {
      id: tab._id ? String(tab._id) : "",
      name: tab.name,
      baseJackpotAmountKES: tab.baseJackpotAmountKES,
      inviteAmountKES: tab.inviteAmountKES,
      fixedPredictionModeEnabled: tab.fixedPredictionModeEnabled,
      fixedPredictionCount: tab.fixedPredictionCount ?? null,
      isEnabled: tab.isEnabled !== false,
      createdAt: tab.createdAt ? new Date(tab.createdAt).toISOString() : null,
      updatedAt: tab.updatedAt ? new Date(tab.updatedAt).toISOString() : null,
    };
  }
}
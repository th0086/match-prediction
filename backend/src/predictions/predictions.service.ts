import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { WinnersQueryDto } from "../admin/admin.dto";
import { JackpotState, JackpotStateDocument } from "../draws/jackpot-state.schema";
import { PayoutRecord, PayoutRecordDocument } from "../draws/payout-record.schema";
import { Match, MatchDocument } from "../matches/match.schema";
import {
  buildPredictionJackpotScope,
  JACKPOT_CURRENCY,
} from "../split-tabs/split-tab.constants";
import { SplitTab, SplitTabDocument } from "../split-tabs/split-tab.schema";
import { Team, TeamDocument } from "../teams/team.schema";
import { User, UserDocument } from "../users/user.schema";
import { UsersService } from "../users/users.service";
import { CreatePredictionDto } from "./predictions.dto";
import { Prediction, PredictionDocument } from "./prediction.schema";

@Injectable()
export class PredictionsService implements OnModuleInit {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectModel(Prediction.name) private readonly predictionModel: Model<PredictionDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(JackpotState.name) private readonly jackpotStateModel: Model<JackpotStateDocument>,
    @InjectModel(PayoutRecord.name) private readonly payoutRecordModel: Model<PayoutRecordDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(SplitTab.name) private readonly splitTabModel: Model<SplitTabDocument>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    // Drop old unique index from previous single-ticket rule.
    const indexes = await this.predictionModel.collection.indexes();
    const legacyUniqueIndex = indexes.find(
      (index) => index.name === "userId_1_matchId_1" && index.unique,
    );
    if (legacyUniqueIndex?.name) {
      await this.predictionModel.collection.dropIndex(legacyUniqueIndex.name);
      this.logger.log("Dropped legacy unique index userId_1_matchId_1 for multi-ticket mode.");
    }
  }

  async getPublicState(splitTabId?: string) {
    const now = new Date();
    const allSplitTabs = await this.splitTabModel.find().sort({ createdAt: 1, _id: 1 }).lean();
    const splitTabs = allSplitTabs.filter((splitTab) => splitTab.isEnabled !== false);
    const activeSplitTab = this.resolveActiveSplitTab(splitTabs, splitTabId);
    if (!activeSplitTab) {
      return {
        splitTabs: [],
        activeSplitTabId: null,
        jackpot: null,
        teams: [],
        matches: [],
        updatedAt: now.toISOString(),
      };
    }

    const jackpotStates = await Promise.all(splitTabs.map((tab) => this.getOrCreateJackpotStateForSplitTab(tab)));
    const jackpotStateByTabId = new Map(jackpotStates.map((state) => [state.scope.replace(/^prediction-tab:/, ""), state]));

    const [teams, matches, counts] = await Promise.all([
      this.teamModel.find({ isActive: true }).sort({ name: 1 }).lean(),
      this.matchModel.find({ isPublished: true, splitTabId: activeSplitTab._id }).sort({ predictionDeadline: 1, createdAt: -1 }).lean(),
      this.predictionModel.aggregate<{ _id: Types.ObjectId; total: number }>([
        { $group: { _id: "$matchId", total: { $sum: 1 } } },
      ]),
    ]);

    const teamMap = new Map(teams.map((team) => [String(team._id), this.toTeamDto(team)]));
    const countMap = new Map(counts.map((item) => [String(item._id), item.total]));
    const activeJackpot = jackpotStateByTabId.get(String(activeSplitTab._id));

    return {
      splitTabs: splitTabs.map((tab) => {
        const state = jackpotStateByTabId.get(String(tab._id));
        return this.toSplitTabDto(tab, state?.currentAmountKES ?? tab.baseJackpotAmountKES, state?.currency ?? JACKPOT_CURRENCY);
      }),
      activeSplitTabId: String(activeSplitTab._id),
      jackpot: {
        splitTabId: String(activeSplitTab._id),
        name: activeSplitTab.name,
        amount: activeJackpot?.currentAmountKES ?? activeSplitTab.baseJackpotAmountKES,
        currency: activeJackpot?.currency ?? JACKPOT_CURRENCY,
        inviteAmountKES: activeSplitTab.inviteAmountKES,
        baseJackpotAmountKES: activeSplitTab.baseJackpotAmountKES,
        fixedPredictionModeEnabled: activeSplitTab.fixedPredictionModeEnabled,
        fixedPredictionCount: activeSplitTab.fixedPredictionCount ?? null,
      },
      teams: Array.from(teamMap.values()),
      matches: matches.map((match) => this.toMatchDto(match, teamMap, countMap.get(String(match._id)) ?? 0)),
      updatedAt: now.toISOString(),
    };
  }

  async createPrediction(userId: string, dto: CreatePredictionDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException("Invalid user.");
    }

    const [match, team] = await Promise.all([
      this.matchModel.findById(new Types.ObjectId(dto.matchId)),
      this.teamModel.findById(new Types.ObjectId(dto.teamId)),
    ]);

    if (!match || !match.isPublished || match.status === "Settled") {
      throw new BadRequestException("Match is not available for prediction.");
    }
    if (!team || !team.isActive) {
      throw new BadRequestException("Selected team is not available.");
    }
    if (!match.teamIds.some((teamId) => String(teamId) === dto.teamId)) {
      throw new BadRequestException("Selected team does not belong to this match.");
    }
    if (new Date(match.predictionDeadline).getTime() <= Date.now()) {
      throw new BadRequestException("Prediction deadline has already passed.");
    }

    const splitTab = await this.getSplitTabForMatch(match);

    let remainingTickets = 0;
    if (splitTab.fixedPredictionModeEnabled) {
      const fixedTotal = Math.max(0, splitTab.fixedPredictionCount ?? 0);
      const usedInMatch = await this.predictionModel.countDocuments({
        userId: new Types.ObjectId(userId),
        matchId: match._id,
        isAdminInjected: { $ne: true },
      });
      if (usedInMatch >= fixedTotal) {
        throw new BadRequestException("No prediction chances left.");
      }
      remainingTickets = Math.max(0, fixedTotal - (usedInMatch + 1));
    } else {
      const allowance = await this.usersService.consumePredictionAllowance(userId, {
        splitTabId: String(splitTab._id),
        fixedPredictionModeEnabled: false,
        fixedPredictionCount: null,
      });
      if (!allowance || !allowance.ok) {
        throw new BadRequestException("No prediction chances left.");
      }
      remainingTickets = allowance.snapshot.remaining;
    }

    const prediction = await this.predictionModel.create({
      userId: new Types.ObjectId(userId),
      matchId: match._id,
      selectedTeamId: team._id,
      lockedAt: new Date(),
      status: "Locked",
      payoutKES: 0,
      isAdminInjected: false,
    });

    return {
      id: String(prediction._id),
      matchId: String(match._id),
      teamId: String(team._id),
      status: prediction.status,
      lockedAt: prediction.lockedAt.toISOString(),
      remainingTickets,
      splitTabId: String(splitTab._id),
    };
  }

  async getPredictionsForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const predictions = await this.predictionModel.find({ userId: new Types.ObjectId(userId), isAdminInjected: { $ne: true } }).sort({ createdAt: -1 }).lean();
    const matchIds = Array.from(new Set(predictions.map((prediction) => String(prediction.matchId))));
    const teamIds = Array.from(new Set(predictions.map((prediction) => String(prediction.selectedTeamId))));

    const [matches, teams] = await Promise.all([
      matchIds.length ? this.matchModel.find({ _id: { $in: matchIds.map((matchId) => new Types.ObjectId(matchId)) } }).lean() : [],
      teamIds.length ? this.teamModel.find({ _id: { $in: teamIds.map((teamId) => new Types.ObjectId(teamId)) } }).lean() : [],
    ]);

    const splitTabIds = Array.from(new Set(matches.map((match) => String(match.splitTabId)).filter(Boolean)));
    const splitTabs = splitTabIds.length
      ? await this.splitTabModel.find({ _id: { $in: splitTabIds.map((id) => new Types.ObjectId(id)) } }).lean()
      : [];

    const matchMap = new Map(matches.map((match) => [String(match._id), match]));
    const teamMap = new Map(teams.map((team) => [String(team._id), team]));
    const splitTabMap = new Map(splitTabs.map((splitTab) => [String(splitTab._id), splitTab]));

    return predictions.map((prediction) => {
      const match = matchMap.get(String(prediction.matchId));
      const selectedTeam = teamMap.get(String(prediction.selectedTeamId));
      const winningTeam = match?.winningTeamId ? teamMap.get(String(match.winningTeamId)) : null;
      const splitTab = match?.splitTabId ? splitTabMap.get(String(match.splitTabId)) : null;

      return {
        id: String(prediction._id),
        matchId: String(prediction.matchId),
        matchName: match?.name ?? "",
        teamId: String(prediction.selectedTeamId),
        teamName: selectedTeam?.name ?? "",
        teamIconUrl: selectedTeam?.iconUrl ?? null,
        winningTeamId: match?.winningTeamId ? String(match.winningTeamId) : null,
        winningTeamName: winningTeam?.name ?? null,
        status: prediction.status,
        payoutKES: prediction.payoutKES,
        lockedAt: prediction.lockedAt.toISOString(),
        settledAt: prediction.settledAt?.toISOString() ?? null,
        predictionDeadline: match?.predictionDeadline?.toISOString() ?? null,
        splitTabId: match?.splitTabId ? String(match.splitTabId) : null,
        splitTabName: splitTab?.name ?? null,
      };
    });
  }

  async getWalletCreditsForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const payouts = await this.payoutRecordModel
      .find({ userId: new Types.ObjectId(userId), predictionId: { $exists: true } })
      .sort({ settledAt: -1 })
      .limit(50)
      .lean();

    return payouts.map((payout) => ({
      id: payout._id.toString(),
      predictionId: payout.predictionId ? payout.predictionId.toString() : null,
      matchId: payout.matchId ? payout.matchId.toString() : null,
      settlementKey: payout.settlementKey,
      jackpotBeforeSplitKES: payout.jackpotBeforeSplitKES,
      winnerCount: payout.winnerCount,
      payoutKES: payout.payoutKES,
      settledAt: payout.settledAt.toISOString(),
      currency: "KES",
    }));
  }

  async addInjectedPredictions(adminUserId: string, matchId: string, teamId: string, quantity: number) {
    if (!Types.ObjectId.isValid(adminUserId) || !Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException("Invalid admin, match, or team id.");
    }

    const safeQuantity = Math.floor(quantity);
    if (!Number.isFinite(safeQuantity) || safeQuantity < 1) {
      throw new BadRequestException("Prediction quantity must be at least 1.");
    }

    const [match, team] = await Promise.all([
      this.matchModel.findById(new Types.ObjectId(matchId)),
      this.teamModel.findById(new Types.ObjectId(teamId)),
    ]);

    if (!match || !match.isPublished || match.status !== "Open") {
      throw new BadRequestException("Only published open matches can receive injected predictions.");
    }
    if (!team || !team.isActive) {
      throw new BadRequestException("Selected team is not available.");
    }
    if (!match.teamIds.some((existingTeamId) => String(existingTeamId) === teamId)) {
      throw new BadRequestException("Selected team does not belong to this match.");
    }
    if (new Date(match.predictionDeadline).getTime() <= Date.now()) {
      throw new BadRequestException("Prediction deadline has already passed.");
    }

    await this.getSplitTabForMatch(match);

    const now = new Date();
    const docs = Array.from({ length: safeQuantity }, () => ({
      userId: new Types.ObjectId(adminUserId),
      matchId: match._id,
      selectedTeamId: team._id,
      lockedAt: now,
      status: "Locked" as const,
      payoutKES: 0,
      isAdminInjected: true,
    }));

    await this.predictionModel.insertMany(docs);

    const totalPredictions = await this.predictionModel.countDocuments({ matchId: match._id });
    return {
      matchId,
      teamId,
      added: safeQuantity,
      totalPredictions,
      injectedByAdminUserId: adminUserId,
    };
  }

  async settleMatch(matchId: string, winningTeamId: string) {
    if (!Types.ObjectId.isValid(matchId) || !Types.ObjectId.isValid(winningTeamId)) {
      throw new BadRequestException("Invalid match or winning team id.");
    }

    const match = await this.matchModel.findById(new Types.ObjectId(matchId));
    if (!match) {
      throw new BadRequestException("Match not found.");
    }
    if (match.status === "Settled") {
      throw new BadRequestException("Match has already been settled.");
    }
    if (!match.teamIds.some((teamId) => String(teamId) === winningTeamId)) {
      throw new BadRequestException("Winning team does not belong to this match.");
    }

    const splitTab = await this.getSplitTabForMatch(match);
    const settledAt = new Date();
    const session = await this.matchModel.db.startSession();

    try {
      let result = { winnerCount: 0, payoutKES: 0, jackpotBeforeSplitKES: 0 };
      await session.withTransaction(async () => {
        result = await this.applySettlement(match, splitTab, winningTeamId, settledAt, session);
      });
      return { matchId, winningTeamId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Transaction numbers are only allowed on a replica set member or mongos")) {
        throw error;
      }

      this.logger.warn("Mongo transactions unavailable; falling back to non-transaction settlement mode.");
      const result = await this.applySettlement(match, splitTab, winningTeamId, settledAt);
      return { matchId, winningTeamId, ...result };
    } finally {
      await session.endSession();
    }
  }

  async getWinnerReport(query: WinnersQueryDto) {
    const limit = query.limit ?? 200;
    const offset = query.offset ?? 0;
    const condition = await this.buildPredictionCondition(query);
    const [total, predictions] = await Promise.all([
      this.predictionModel.countDocuments(condition),
      this.predictionModel.find(condition).sort({ lockedAt: -1, _id: -1 }).skip(offset).limit(limit).lean(),
    ]);

    return this.buildWinnerPayload(predictions, total, limit, offset);
  }

  async buildWinnerCsv(query: WinnersQueryDto) {
    const condition = await this.buildPredictionCondition(query);
    const predictions = await this.predictionModel.find(condition).sort({ lockedAt: -1, _id: -1 }).lean();
    const payload = await this.buildWinnerPayload(predictions, predictions.length, predictions.length, 0);
    const header = ["splitTab", "match", "phone", "selectedTeam", "status", "payoutKES", "predictionTime", "winningTeam", "predictionId", "userId"];
    const lines = [header.join(",")];
    for (const item of payload.items) {
      lines.push([
        item.splitTabName,
        item.matchName,
        item.phone,
        item.selectedTeamName,
        item.status,
        String(item.payoutKES),
        item.lockedAt,
        item.winningTeamName,
        item.predictionId,
        item.userId,
      ].map((value) => this.escapeCsv(value)).join(","));
    }
    return lines.join("\n");
  }

  async getJackpotState(splitTabId?: string) {
    const splitTabs = await this.splitTabModel.find().sort({ createdAt: 1, _id: 1 }).lean();
    const activeSplitTab = this.resolveActiveSplitTab(splitTabs, splitTabId);
    if (!activeSplitTab) {
      return {
        amount: 0,
        currency: JACKPOT_CURRENCY,
        lastSettledAt: null,
        lastSettlementKey: null,
      };
    }

    const jackpot = await this.getOrCreateJackpotStateForSplitTab(activeSplitTab);
    return {
      amount: jackpot.currentAmountKES,
      currency: jackpot.currency,
      lastSettledAt: jackpot.lastSettledAt?.toISOString() ?? null,
      lastSettlementKey: jackpot.lastSettlementKey ?? null,
    };
  }

  private async applySettlement(match: MatchDocument, splitTab: SplitTabDocument, winningTeamId: string, settledAt: Date, session?: unknown) {
    const splitTabId = String(splitTab._id);
    const jackpotScope = buildPredictionJackpotScope(splitTabId);
    const settlementKey = `match:${splitTabId}:${match._id.toString()}:${settledAt.toISOString()}`;
    const winningObjectId = new Types.ObjectId(winningTeamId);
    const predictions = session
      ? await this.predictionModel.find({ matchId: match._id }).session(session as never)
      : await this.predictionModel.find({ matchId: match._id });

    const winners = predictions.filter((prediction) => String(prediction.selectedTeamId) === winningTeamId);
    const losers = predictions.filter((prediction) => String(prediction.selectedTeamId) !== winningTeamId);

    const jackpot = session
      ? await this.jackpotStateModel.findOneAndUpdate(
        { scope: jackpotScope },
        { $setOnInsert: { scope: jackpotScope, currentAmountKES: splitTab.baseJackpotAmountKES, currency: JACKPOT_CURRENCY } },
        { new: true, upsert: true, session: session as never },
      )
      : await this.jackpotStateModel.findOneAndUpdate(
        { scope: jackpotScope },
        { $setOnInsert: { scope: jackpotScope, currentAmountKES: splitTab.baseJackpotAmountKES, currency: JACKPOT_CURRENCY } },
        { new: true, upsert: true },
      );

    const jackpotBeforeSplitKES = jackpot.currentAmountKES;
    const winnerCount = winners.length;
    const payoutKES = winnerCount > 0 ? Math.floor(Math.floor(jackpotBeforeSplitKES / winnerCount) / 10) : 0;

    if (winners.length > 0) {
      await this.predictionModel.updateMany(
        { _id: { $in: winners.map((prediction) => prediction._id) } },
        { $set: { status: "Won", settledAt, payoutKES } },
        session ? { session: session as never } : undefined,
      );

      const winnerTicketsByUser = new Map<string, { userId: Types.ObjectId; tickets: number }>();
      for (const winner of winners) {
        const key = String(winner.userId);
        const existing = winnerTicketsByUser.get(key);
        if (existing) {
          existing.tickets += 1;
        } else {
          winnerTicketsByUser.set(key, {
            userId: winner.userId,
            tickets: 1,
          });
        }
      }

      const walletUpdates = Array.from(winnerTicketsByUser.values()).map((row) => ({
        updateOne: {
          filter: { _id: row.userId },
          update: { $inc: { walletBalanceKES: payoutKES * row.tickets } },
        },
      }));

      if (walletUpdates.length) {
        await this.userModel.bulkWrite(
          walletUpdates,
          session ? { session: session as never } : undefined,
        );
      }

      const payoutRows = winners.map((winner) => ({
        entryId: winner._id,
        predictionId: winner._id,
        matchId: match._id,
        userId: winner.userId,
        selectedTeamId: winner.selectedTeamId,
        winningTeamId: winningObjectId,
        settlementKey,
        jackpotBeforeSplitKES,
        winnerCount,
        payoutKES,
        settledAt,
      }));

      if (session) {
        await this.payoutRecordModel.insertMany(payoutRows, { session: session as never });
      } else {
        await this.payoutRecordModel.insertMany(payoutRows);
      }

      await this.jackpotStateModel.updateOne(
        { scope: jackpotScope },
        {
          $set: {
            currentAmountKES: splitTab.baseJackpotAmountKES,
            lastSettledAt: settledAt,
            lastSettlementKey: settlementKey,
            lastAccumulatedAt: settledAt,
          },
        },
        session ? { session: session as never } : undefined,
      );
    }

    if (losers.length > 0) {
      await this.predictionModel.updateMany(
        { _id: { $in: losers.map((prediction) => prediction._id) } },
        { $set: { status: "Lost", settledAt, payoutKES: 0 } },
        session ? { session: session as never } : undefined,
      );
    }

    match.status = "Settled";
    match.winningTeamId = winningObjectId;
    match.settledAt = settledAt;
    if (session) {
      await match.save({ session: session as never });
    } else {
      await match.save();
    }

    return { winnerCount, payoutKES, jackpotBeforeSplitKES };
  }

  private async buildWinnerPayload(predictions: Array<PredictionDocument | (Prediction & { _id: Types.ObjectId })>, total: number, limit: number, offset: number) {
    const matchIds = Array.from(new Set(predictions.map((prediction) => String(prediction.matchId))));
    const userIds = Array.from(new Set(predictions.map((prediction) => String(prediction.userId))));

    const [matches, users] = await Promise.all([
      matchIds.length ? this.matchModel.find({ _id: { $in: matchIds.map((id) => new Types.ObjectId(id)) } }).lean() : [],
      userIds.length ? this.userModel.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } }).lean() : [],
    ]);

    const splitTabIds = Array.from(new Set(matches.map((match) => String(match.splitTabId)).filter(Boolean)));
    const splitTabs = splitTabIds.length
      ? await this.splitTabModel.find({ _id: { $in: splitTabIds.map((id) => new Types.ObjectId(id)) } }).lean()
      : [];

    const teamIds = Array.from(new Set([
      ...predictions.map((prediction) => String(prediction.selectedTeamId)),
      ...matches.flatMap((match) => match.winningTeamId ? [String(match.winningTeamId)] : []),
    ]));
    const teams = teamIds.length
      ? await this.teamModel.find({ _id: { $in: teamIds.map((id) => new Types.ObjectId(id)) } }).lean()
      : [];

    const matchMap = new Map(matches.map((match) => [String(match._id), match]));
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const teamMap = new Map(teams.map((team) => [String(team._id), team]));
    const splitTabMap = new Map(splitTabs.map((splitTab) => [String(splitTab._id), splitTab.name]));

    return {
      total,
      limit,
      offset,
      items: predictions.map((prediction) => {
        const match = matchMap.get(String(prediction.matchId));
        return {
          predictionId: String(prediction._id),
          userId: String(prediction.userId),
          phone: userMap.get(String(prediction.userId))?.phone ?? "",
          splitTabId: match?.splitTabId ? String(match.splitTabId) : "",
          splitTabName: match?.splitTabId ? splitTabMap.get(String(match.splitTabId)) ?? "" : "",
          matchName: match?.name ?? "",
          selectedTeamName: teamMap.get(String(prediction.selectedTeamId))?.name ?? "",
          winningTeamName: match?.winningTeamId ? teamMap.get(String(match.winningTeamId))?.name ?? "" : "",
          status: prediction.status,
          payoutKES: prediction.payoutKES,
          lockedAt: prediction.lockedAt.toISOString(),
        };
      }),
    };
  }

  private async buildPredictionCondition(query: WinnersQueryDto) {
    const condition: {
      lockedAt?: { $gte?: Date; $lte?: Date };
      status?: "Locked" | "Won" | "Lost";
      userId?: { $in: Types.ObjectId[] } | Types.ObjectId;
      matchId?: { $in: Types.ObjectId[] };
      isAdminInjected?: { $ne: true };
    } = {};

    condition.isAdminInjected = { $ne: true };

    if (query.from || query.to) {
      condition.lockedAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    if (query.status) {
      condition.status = query.status;
    }

    if (query.splitTabId) {
      const splitTabObjectId = new Types.ObjectId(query.splitTabId);
      const matches = await this.matchModel.find({ splitTabId: splitTabObjectId }, { _id: 1 }).lean();
      const matchIds = matches.map((match) => match._id as Types.ObjectId);
      condition.matchId = { $in: matchIds.length > 0 ? matchIds : [new Types.ObjectId("000000000000000000000000")] };
    }

    const normalizedPhone = query.phone?.trim();
    if (normalizedPhone) {
      const escaped = this.escapeRegex(normalizedPhone);
      const users = await this.userModel
        .find({ phone: { $regex: escaped, $options: "i" } }, { _id: 1 })
        .lean();
      const userIds = users.map((user) => user._id as Types.ObjectId);
      condition.userId = userIds.length > 0 ? { $in: userIds } : new Types.ObjectId("000000000000000000000000");
    }

    return condition;
  }

  private async getOrCreateJackpotStateForSplitTab(splitTab: Pick<SplitTabDocument, "_id" | "baseJackpotAmountKES">) {
    const scope = buildPredictionJackpotScope(String(splitTab._id));
    const jackpot = await this.jackpotStateModel.findOneAndUpdate(
      { scope },
      {
        $setOnInsert: {
          scope,
          currentAmountKES: splitTab.baseJackpotAmountKES,
          currency: JACKPOT_CURRENCY,
          lastAccumulatedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    if (jackpot.currentAmountKES < splitTab.baseJackpotAmountKES) {
      await this.jackpotStateModel.updateOne(
        { _id: jackpot._id, currentAmountKES: jackpot.currentAmountKES },
        { $set: { currentAmountKES: splitTab.baseJackpotAmountKES, currency: JACKPOT_CURRENCY } },
      );
      jackpot.currentAmountKES = splitTab.baseJackpotAmountKES;
      jackpot.currency = JACKPOT_CURRENCY;
    }

    return jackpot;
  }

  private toTeamDto(team: Pick<TeamDocument, "_id" | "name" | "country" | "iconUrl" | "isActive">) {
    return {
      id: String(team._id),
      name: team.name,
      country: team.country ?? null,
      iconUrl: team.iconUrl ?? null,
      isActive: team.isActive,
    };
  }

  private toMatchDto(match: Pick<MatchDocument, "_id" | "name" | "description" | "predictionDeadline" | "isPublished" | "status" | "winningTeamId" | "settledAt" | "teamIds" | "splitTabId">, teamMap: Map<string, { id: string; name: string; country: string | null; iconUrl: string | null; isActive: boolean }>, totalPredictions: number) {
    const teams = match.teamIds
      .map((teamId) => teamMap.get(String(teamId)))
      .filter((team): team is { id: string; name: string; country: string | null; iconUrl: string | null; isActive: boolean } => Boolean(team))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      id: String(match._id),
      name: match.name,
      description: match.description ?? null,
      predictionDeadline: match.predictionDeadline.toISOString(),
      isPublished: match.isPublished,
      status: match.status === "Settled" ? "Settled" : (match.predictionDeadline.getTime() > Date.now() ? "Open" : "Closed"),
      winningTeamId: match.winningTeamId ? String(match.winningTeamId) : null,
      settledAt: match.settledAt?.toISOString() ?? null,
      splitTabId: match.splitTabId ? String(match.splitTabId) : null,
      totalPredictions,
      teams,
    };
  }

  private toSplitTabDto(splitTab: SplitTab & { _id?: Types.ObjectId }, currentJackpotAmountKES: number, currency: string) {
    return {
      id: splitTab._id ? String(splitTab._id) : "",
      name: splitTab.name,
      baseJackpotAmountKES: splitTab.baseJackpotAmountKES,
      inviteAmountKES: splitTab.inviteAmountKES,
      fixedPredictionModeEnabled: splitTab.fixedPredictionModeEnabled,
      fixedPredictionCount: splitTab.fixedPredictionCount ?? null,
      isEnabled: splitTab.isEnabled !== false,
      currentJackpotAmountKES,
      currency,
    };
  }

  private resolveActiveSplitTab(splitTabs: Array<SplitTab & { _id: Types.ObjectId }>, requestedSplitTabId?: string) {
    if (requestedSplitTabId && Types.ObjectId.isValid(requestedSplitTabId)) {
      const matched = splitTabs.find((splitTab) => String(splitTab._id) === requestedSplitTabId);
      if (matched) {
        return matched;
      }
    }

    return splitTabs[0] ?? null;
  }

  private async getSplitTabForMatch(match: Pick<MatchDocument, "splitTabId">) {
    if (!match.splitTabId) {
      throw new BadRequestException("Match split tab is missing.");
    }

    const splitTab = await this.splitTabModel.findById(match.splitTabId);
    if (!splitTab) {
      throw new BadRequestException("Split tab not found.");
    }
    if (splitTab.isEnabled === false) {
      throw new BadRequestException("Split tab is disabled.");
    }

    return splitTab;
  }

  private escapeCsv(value: string | number) {
    const stringValue = String(value ?? "");
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateMatchDto, UpdateMatchDto } from "../admin/admin.dto";
import { PayoutRecord, PayoutRecordDocument } from "../draws/payout-record.schema";
import { Prediction, PredictionDocument } from "../predictions/prediction.schema";
import { SplitTab, SplitTabDocument } from "../split-tabs/split-tab.schema";
import { TeamsService } from "../teams/teams.service";
import { Match, MatchDocument } from "./match.schema";

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Prediction.name) private readonly predictionModel: Model<PredictionDocument>,
    @InjectModel(PayoutRecord.name) private readonly payoutRecordModel: Model<PayoutRecordDocument>,
    @InjectModel(SplitTab.name) private readonly splitTabModel: Model<SplitTabDocument>,
    private readonly teamsService: TeamsService,
  ) {}

  async listAll() {
    const matches = await this.matchModel.find().sort({ predictionDeadline: 1, createdAt: -1 }).lean();
    return matches.map((match) => this.toDto(match));
  }

  async listPublished() {
    const matches = await this.matchModel.find({ isPublished: true }).sort({ predictionDeadline: 1, createdAt: -1 }).lean();
    return matches.map((match) => this.toDto(match));
  }

  async create(dto: CreateMatchDto) {
    await this.teamsService.ensureExistingTeamIds(dto.teamIds);
    await this.ensureExistingSplitTabId(dto.splitTabId);
    const match = await this.matchModel.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
      teamIds: dto.teamIds.map((teamId) => new Types.ObjectId(teamId)),
      splitTabId: new Types.ObjectId(dto.splitTabId),
      predictionDeadline: new Date(dto.predictionDeadline),
      isPublished: dto.isPublished ?? true,
      status: "Open",
    });
    return this.toDto(match.toObject());
  }

  async update(matchId: string, dto: UpdateMatchDto) {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException("Invalid match id.");
    }

    const match = await this.matchModel.findById(new Types.ObjectId(matchId));
    if (!match) {
      throw new BadRequestException("Match not found.");
    }

    if (match.status === "Settled") {
      throw new BadRequestException("Settled matches cannot be modified.");
    }

    if (typeof dto.description === "string") {
      match.description = dto.description.trim() || undefined;
    }
    if (typeof dto.predictionDeadline === "string") {
      match.predictionDeadline = new Date(dto.predictionDeadline);
    }
    if (typeof dto.splitTabId === "string") {
      await this.ensureExistingSplitTabId(dto.splitTabId);
      match.splitTabId = new Types.ObjectId(dto.splitTabId);
    }
    if (typeof dto.isPublished === "boolean") {
      match.isPublished = dto.isPublished;
    }

    await match.save();
    return this.toDto(match.toObject());
  }

  async deleteSettled(matchId: string) {
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException("Invalid match id.");
    }

    const matchObjectId = new Types.ObjectId(matchId);
    const match = await this.matchModel.findById(matchObjectId);
    if (!match) {
      throw new BadRequestException("Match not found.");
    }

    if (match.status !== "Settled") {
      throw new BadRequestException("Only settled matches can be deleted.");
    }

    const [predictionDeleteResult, payoutDeleteResult] = await Promise.all([
      this.predictionModel.deleteMany({ matchId: matchObjectId }),
      this.payoutRecordModel.deleteMany({ matchId: matchObjectId }),
    ]);

    await this.matchModel.deleteOne({ _id: matchObjectId });

    return {
      deleted: true,
      matchId,
      deletedPredictions: predictionDeleteResult.deletedCount ?? 0,
      deletedPayouts: payoutDeleteResult.deletedCount ?? 0,
    };
  }

  private toDto(match: MatchDocument | (Match & { _id?: Types.ObjectId })) {
    return {
      id: match._id ? String(match._id) : "",
      name: match.name,
      description: match.description ?? null,
      teamIds: (match.teamIds ?? []).map((teamId) => String(teamId)),
      splitTabId: match.splitTabId ? String(match.splitTabId) : null,
      predictionDeadline: match.predictionDeadline instanceof Date
        ? match.predictionDeadline.toISOString()
        : new Date(match.predictionDeadline).toISOString(),
      isPublished: match.isPublished,
      status: match.status,
      winningTeamId: match.winningTeamId ? String(match.winningTeamId) : null,
      settledAt: match.settledAt ? new Date(match.settledAt).toISOString() : null,
      createdAt: match.createdAt ? new Date(match.createdAt).toISOString() : null,
      updatedAt: match.updatedAt ? new Date(match.updatedAt).toISOString() : null,
    };
  }

  private async ensureExistingSplitTabId(splitTabId: string) {
    if (!Types.ObjectId.isValid(splitTabId)) {
      throw new BadRequestException("Invalid split tab id.");
    }

    const tab = await this.splitTabModel.findById(new Types.ObjectId(splitTabId)).lean();
    if (!tab) {
      throw new BadRequestException("Split tab not found.");
    }
  }
}
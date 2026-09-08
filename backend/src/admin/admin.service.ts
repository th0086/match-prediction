import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { GameService } from "../game/game.service";
import { SplitTabsService } from "../split-tabs/split-tabs.service";
import { StorageService } from "../storage/storage.service";
import { UsersService } from "../users/users.service";
import {
  AddMatchPredictionsDto,
  CreateSplitTabDto,
  CreateMatchDto,
  CreateTeamDto,
  InviteStatusQueryDto,
  SettleMatchDto,
  UpdateSplitTabDto,
  UpdateMatchDto,
  UpdateTeamDto,
  WinnersQueryDto,
} from "./admin.dto";
import { AdminConfig, AdminConfigDocument } from "./admin-config.schema";

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly configKey = "runtime";
  private readonly defaultJackpotIncrementAmount = 123;
  private loaded = false;
  private jackpotIncrementAmount = this.defaultJackpotIncrementAmount;
  private dataPin = "1234";

  constructor(
    @InjectModel(AdminConfig.name)
    private readonly adminConfigModel: Model<AdminConfigDocument>,
    private readonly configService: ConfigService,
    private readonly gameService: GameService,
    private readonly splitTabsService: SplitTabsService,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    this.dataPin = this.getDefaultDataPin();
    await this.ensureConfigLoaded();
  }

  async listTeams() {
    return this.gameService.listTeams({ activeOnly: false });
  }

  async listSplitTabs() {
    return this.splitTabsService.listAll();
  }

  async createSplitTab(dto: CreateSplitTabDto) {
    return this.splitTabsService.create(dto);
  }

  async updateSplitTab(splitTabId: string, dto: UpdateSplitTabDto) {
    return this.splitTabsService.update(splitTabId, dto);
  }

  async deleteSplitTab(splitTabId: string) {
    return this.splitTabsService.delete(splitTabId);
  }

  async createTeam(dto: CreateTeamDto) {
    return this.gameService.createTeam(dto);
  }

  async updateTeam(teamId: string, dto: UpdateTeamDto) {
    return this.gameService.updateTeam(teamId, dto);
  }

  async listMatches() {
    return this.gameService.listMatches({ publishedOnly: false });
  }

  async createMatch(dto: CreateMatchDto) {
    return this.gameService.createMatch(dto);
  }

  async updateMatch(matchId: string, dto: UpdateMatchDto) {
    return this.gameService.updateMatch(matchId, dto);
  }

  async settleMatch(matchId: string, dto: SettleMatchDto) {
    return this.gameService.settleMatch(matchId, dto.winningTeamId);
  }

  async addMatchPredictions(adminUserId: string, matchId: string, dto: AddMatchPredictionsDto) {
    return this.gameService.addMatchPredictions(adminUserId, matchId, dto.teamId, dto.quantity);
  }

  async deleteSettledMatch(matchId: string) {
    return this.gameService.deleteSettledMatch(matchId);
  }

  async uploadTeamIcon(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
  } | undefined) {
    if (!file) {
      throw new BadRequestException("Team icon file is required.");
    }

    return this.storageService.uploadTeamIcon(file);
  }

  async getWinners(query: WinnersQueryDto) {
    return this.gameService.getWinners(query);
  }

  async buildWinnersCsv(query: WinnersQueryDto) {
    return this.gameService.buildWinnersCsv(query);
  }

  async getInviteStats(query: InviteStatusQueryDto) {
    return this.usersService.getInviteStats(query);
  }

  async buildInviteStatsCsv(query: InviteStatusQueryDto) {
    return this.usersService.buildInviteStatsCsv(query);
  }

  async getJackpotIncrement() {
    await this.ensureConfigLoaded();
    return { jackpotIncrementAmount: this.jackpotIncrementAmount };
  }

  async updateJackpotIncrement(amount: number) {
    await this.ensureConfigLoaded();
    this.jackpotIncrementAmount = amount;
    await this.adminConfigModel.findOneAndUpdate(
      { key: this.configKey },
      { $set: { jackpotIncrementAmount: amount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return this.getJackpotIncrement();
  }

  async getDataPin() {
    await this.ensureConfigLoaded();
    return { dataPin: this.dataPin };
  }

  async updateDataPin(pin: string) {
    await this.ensureConfigLoaded();
    this.dataPin = pin;
    await this.adminConfigModel.findOneAndUpdate(
      { key: this.configKey },
      { $set: { dataPin: pin } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return this.getDataPin();
  }

  async verifyDataPin(pin: string) {
    await this.ensureConfigLoaded();
    return { valid: pin === this.dataPin };
  }

  async getStorageConfig() {
    return {
      bucket: this.configService.get<string>("DO_SPACES_BUCKET") ?? "",
      endpoint: this.configService.get<string>("DO_SPACES_ENDPOINT") ?? "",
      publicBaseUrl: this.configService.get<string>("DO_SPACES_PUBLIC_BASE_URL") ?? "",
      prefix: this.configService.get<string>("DO_SPACES_TEAMS_PREFIX") ?? "teams",
    };
  }

  // Backward-compatible runtime payload for remaining legacy lottery services during migration.
  async getGameRuntimeConfig() {
    await this.ensureConfigLoaded();
    return {
      youtubeVideoId: "",
      liveOverlayEnabled: false,
      realtimeMode: "polling",
      pollingIntervalSeconds: 5,
      jackpotIncrementAmount: this.jackpotIncrementAmount,
        dataPin: this.dataPin,
    };
  }

  private async ensureConfigLoaded() {
    if (this.loaded) {
      return;
    }

    const defaultDataPin = this.getDefaultDataPin();

    const existing = await this.adminConfigModel.findOne({ key: this.configKey }).lean();
    if (!existing) {
      await this.adminConfigModel.create({
        key: this.configKey,
        jackpotIncrementAmount: this.defaultJackpotIncrementAmount,
        dataPin: defaultDataPin,
      });
      this.jackpotIncrementAmount = this.defaultJackpotIncrementAmount;
      this.dataPin = defaultDataPin;
      this.loaded = true;
      return;
    }

    this.jackpotIncrementAmount = existing.jackpotIncrementAmount ?? this.defaultJackpotIncrementAmount;
    this.dataPin = existing.dataPin ?? defaultDataPin;
    this.loaded = true;
  }

  private getDefaultDataPin(): string {
    const configured = this.configService.get<string>("DATA_PIN")?.trim() ?? "1234";
    return /^\d{4}$/.test(configured) ? configured : "1234";
  }
}

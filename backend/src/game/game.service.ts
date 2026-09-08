import { Injectable } from "@nestjs/common";
import { CreateMatchDto, CreateTeamDto, UpdateMatchDto, UpdateTeamDto, WinnersQueryDto } from "../admin/admin.dto";
import { MatchesService } from "../matches/matches.service";
import { CreatePredictionDto } from "../predictions/predictions.dto";
import { PredictionsService } from "../predictions/predictions.service";
import { TeamsService } from "../teams/teams.service";

@Injectable()
export class GameService {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly matchesService: MatchesService,
    private readonly predictionsService: PredictionsService,
  ) {}

  getPublicState(splitTabId?: string) {
    return this.predictionsService.getPublicState(splitTabId);
  }

  createPrediction(userId: string, dto: CreatePredictionDto) {
    return this.predictionsService.createPrediction(userId, dto);
  }

  getPredictionsForUser(userId: string) {
    return this.predictionsService.getPredictionsForUser(userId);
  }

  getWalletCreditsForUser(userId: string) {
    return this.predictionsService.getWalletCreditsForUser(userId);
  }

  listTeams(options?: { activeOnly?: boolean }) {
    return this.teamsService.listAll(options);
  }

  createTeam(dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  updateTeam(teamId: string, dto: UpdateTeamDto) {
    return this.teamsService.update(teamId, dto);
  }

  listMatches(options?: { publishedOnly?: boolean }) {
    return options?.publishedOnly ? this.matchesService.listPublished() : this.matchesService.listAll();
  }

  createMatch(dto: CreateMatchDto) {
    return this.matchesService.create(dto);
  }

  updateMatch(matchId: string, dto: UpdateMatchDto) {
    return this.matchesService.update(matchId, dto);
  }

  settleMatch(matchId: string, winningTeamId: string) {
    return this.predictionsService.settleMatch(matchId, winningTeamId);
  }

  addMatchPredictions(adminUserId: string, matchId: string, teamId: string, quantity: number) {
    return this.predictionsService.addInjectedPredictions(adminUserId, matchId, teamId, quantity);
  }

  deleteSettledMatch(matchId: string) {
    return this.matchesService.deleteSettled(matchId);
  }

  getWinners(query: WinnersQueryDto) {
    return this.predictionsService.getWinnerReport(query);
  }

  buildWinnersCsv(query: WinnersQueryDto) {
    return this.predictionsService.buildWinnerCsv(query);
  }
}
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  AddMatchPredictionsDto,
  CreateSplitTabDto,
  CreateMatchDto,
  CreateTeamDto,
  InviteStatusQueryDto,
  SettleMatchDto,
  UpdateSplitTabDto,
  UpdateDataPinDto,
  UpdateJackpotIncrementDto,
  UpdateMatchDto,
  UpdateTeamDto,
  WinnersQueryDto,
} from "./admin.dto";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("me")
  me() {
    return { canAccessAdmin: true };
  }

  @Get("jackpot-increment")
  getJackpotIncrement() {
    return this.adminService.getJackpotIncrement();
  }

  @Patch("jackpot-increment")
  updateJackpotIncrement(@Body() dto: UpdateJackpotIncrementDto) {
    return this.adminService.updateJackpotIncrement(dto.amount);
  }

  @Get("data-pin")
  getDataPin() {
    return this.adminService.getDataPin();
  }

  @Patch("data-pin")
  updateDataPin(@Body() dto: UpdateDataPinDto) {
    return this.adminService.updateDataPin(dto.pin);
  }

  @Get("teams")
  listTeams() {
    return this.adminService.listTeams();
  }

  @Get("split-tabs")
  listSplitTabs() {
    return this.adminService.listSplitTabs();
  }

  @Post("split-tabs")
  createSplitTab(@Body() dto: CreateSplitTabDto) {
    return this.adminService.createSplitTab(dto);
  }

  @Patch("split-tabs/:splitTabId")
  updateSplitTab(@Param("splitTabId") splitTabId: string, @Body() dto: UpdateSplitTabDto) {
    return this.adminService.updateSplitTab(splitTabId, dto);
  }

  @Delete("split-tabs/:splitTabId")
  deleteSplitTab(@Param("splitTabId") splitTabId: string) {
    return this.adminService.deleteSplitTab(splitTabId);
  }

  @Post("teams")
  createTeam(@Body() dto: CreateTeamDto) {
    return this.adminService.createTeam(dto);
  }

  @Patch("teams/:teamId")
  updateTeam(@Param("teamId") teamId: string, @Body() dto: UpdateTeamDto) {
    return this.adminService.updateTeam(teamId, dto);
  }

  @Post("teams/upload-icon")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadTeamIcon(
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.adminService.uploadTeamIcon(file);
  }

  @Get("matches")
  listMatches() {
    return this.adminService.listMatches();
  }

  @Post("matches")
  createMatch(@Body() dto: CreateMatchDto) {
    return this.adminService.createMatch(dto);
  }

  @Patch("matches/:matchId")
  updateMatch(@Param("matchId") matchId: string, @Body() dto: UpdateMatchDto) {
    return this.adminService.updateMatch(matchId, dto);
  }

  @Post("matches/:matchId/settle")
  settleMatch(@Param("matchId") matchId: string, @Body() dto: SettleMatchDto) {
    return this.adminService.settleMatch(matchId, dto);
  }

  @Post("matches/:matchId/inject-predictions")
  addMatchPredictions(
    @Req() req: { user: { sub: string } },
    @Param("matchId") matchId: string,
    @Body() dto: AddMatchPredictionsDto,
  ) {
    return this.adminService.addMatchPredictions(req.user.sub, matchId, dto);
  }

  @Delete("matches/:matchId")
  deleteSettledMatch(@Param("matchId") matchId: string) {
    return this.adminService.deleteSettledMatch(matchId);
  }

  @Get("winners")
  listWinners(@Query() query: WinnersQueryDto) {
    return this.adminService.getWinners(query);
  }

  @Get("invite-stats")
  listInviteStats(@Query() query: InviteStatusQueryDto) {
    return this.adminService.getInviteStats(query);
  }

  @Get("invite-stats/csv")
  async downloadInviteStatsCsv(@Query() query: InviteStatusQueryDto, @Res() res: Response) {
    const csv = await this.adminService.buildInviteStatsCsv(query);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=invite-status-list-${today}.csv`);
    res.send(csv);
  }

  @Get("winners/csv")
  async downloadWinnersCsv(@Query() query: WinnersQueryDto, @Res() res: Response) {
    const csv = await this.adminService.buildWinnersCsv(query);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=prediction-record-list-${today}.csv`);
    res.send(csv);
  }
}

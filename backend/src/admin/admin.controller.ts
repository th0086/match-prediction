import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("me")
  @Permissions("admin:access")
  me() {
    return { canAccessAdmin: true };
  }

  @Get("jackpot-increment")
  @Permissions("draw:manage")
  getJackpotIncrement() {
    return this.adminService.getJackpotIncrement();
  }

  @Patch("jackpot-increment")
  @Permissions("draw:manage")
  updateJackpotIncrement(@Body() dto: UpdateJackpotIncrementDto) {
    return this.adminService.updateJackpotIncrement(dto.amount);
  }

  @Get("data-pin")
  @Permissions("draw:manage")
  getDataPin() {
    return this.adminService.getDataPin();
  }

  @Patch("data-pin")
  @Permissions("draw:manage")
  updateDataPin(@Body() dto: UpdateDataPinDto) {
    return this.adminService.updateDataPin(dto.pin);
  }

  @Get("teams")
  @Permissions("draw:manage")
  listTeams() {
    return this.adminService.listTeams();
  }

  @Get("split-tabs")
  @Permissions("draw:manage")
  listSplitTabs() {
    return this.adminService.listSplitTabs();
  }

  @Post("split-tabs")
  @Permissions("draw:manage")
  createSplitTab(@Body() dto: CreateSplitTabDto) {
    return this.adminService.createSplitTab(dto);
  }

  @Patch("split-tabs/:splitTabId")
  @Permissions("draw:manage")
  updateSplitTab(@Param("splitTabId") splitTabId: string, @Body() dto: UpdateSplitTabDto) {
    return this.adminService.updateSplitTab(splitTabId, dto);
  }

  @Delete("split-tabs/:splitTabId")
  @Permissions("draw:manage")
  deleteSplitTab(@Param("splitTabId") splitTabId: string) {
    return this.adminService.deleteSplitTab(splitTabId);
  }

  @Post("teams")
  @Permissions("draw:manage")
  createTeam(@Body() dto: CreateTeamDto) {
    return this.adminService.createTeam(dto);
  }

  @Patch("teams/:teamId")
  @Permissions("draw:manage")
  updateTeam(@Param("teamId") teamId: string, @Body() dto: UpdateTeamDto) {
    return this.adminService.updateTeam(teamId, dto);
  }

  @Post("teams/upload-icon")
  @Permissions("draw:manage")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadTeamIcon(
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.adminService.uploadTeamIcon(file);
  }

  @Get("matches")
  @Permissions("draw:manage")
  listMatches() {
    return this.adminService.listMatches();
  }

  @Post("matches")
  @Permissions("draw:manage")
  createMatch(@Body() dto: CreateMatchDto) {
    return this.adminService.createMatch(dto);
  }

  @Patch("matches/:matchId")
  @Permissions("draw:manage")
  updateMatch(@Param("matchId") matchId: string, @Body() dto: UpdateMatchDto) {
    return this.adminService.updateMatch(matchId, dto);
  }

  @Post("matches/:matchId/settle")
  @Permissions("draw:manage")
  settleMatch(@Param("matchId") matchId: string, @Body() dto: SettleMatchDto) {
    return this.adminService.settleMatch(matchId, dto);
  }

  @Post("matches/:matchId/inject-predictions")
  @Permissions("draw:manage")
  addMatchPredictions(
    @Req() req: { user: { sub: string } },
    @Param("matchId") matchId: string,
    @Body() dto: AddMatchPredictionsDto,
  ) {
    return this.adminService.addMatchPredictions(req.user.sub, matchId, dto);
  }

  @Delete("matches/:matchId")
  @Permissions("draw:manage")
  deleteSettledMatch(@Param("matchId") matchId: string) {
    return this.adminService.deleteSettledMatch(matchId);
  }

  @Get("winners")
  @Permissions("draw:manage")
  listWinners(@Query() query: WinnersQueryDto) {
    return this.adminService.getWinners(query);
  }

  @Get("invite-stats")
  @Permissions("draw:manage")
  listInviteStats(@Query() query: InviteStatusQueryDto) {
    return this.adminService.getInviteStats(query);
  }

  @Get("invite-stats/csv")
  @Permissions("draw:manage")
  async downloadInviteStatsCsv(@Query() query: InviteStatusQueryDto, @Res() res: Response) {
    const csv = await this.adminService.buildInviteStatsCsv(query);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=invite-status-list-${today}.csv`);
    res.send(csv);
  }

  @Get("winners/csv")
  @Permissions("draw:manage")
  async downloadWinnersCsv(@Query() query: WinnersQueryDto, @Res() res: Response) {
    const csv = await this.adminService.buildWinnersCsv(query);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=prediction-record-list-${today}.csv`);
    res.send(csv);
  }
}

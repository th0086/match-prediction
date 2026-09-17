import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InviteStatusQueryDto, VerifyDataPinDto, WinnersQueryDto } from "./admin.dto";
import { AdminService } from "./admin.service";

@Controller("data")
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly adminService: AdminService) {}

  @Post("verify-pin")
  verifyPin(@Body() dto: VerifyDataPinDto) {
    return this.adminService.verifyDataPin(dto.pin);
  }

  @Get("split-tabs")
  listSplitTabs() {
    return this.adminService.listSplitTabs();
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

  @Get("winners")
  listWinners(@Query() query: WinnersQueryDto) {
    return this.adminService.getWinners(query);
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

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { ExternalLoginDto, LoginDto, RefreshDto, RegisterDto } from "./dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("external-login")
  async externalLogin(@Body() dto: ExternalLoginDto) {
    try {
      return await this.authService.externalLogin(dto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new HttpException({ success: false, error: "Invalid merchant" }, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("sync-external-status")
  async syncExternalStatus(@Req() req: { user: { sub: string; authMethod?: string } }) {
    return this.authService.syncExternalStatus(req.user.sub, req.user.authMethod);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: { user: { sub: string; phone: string; role: string; permissions: string[]; authMethod?: "local" | "external" } }) {
    const { sub, phone, role, permissions, authMethod } = req.user;
    const user = await this.usersService.findById(sub);
    const allowance = await this.usersService.getDailyBetAllowance(sub);
    const splitTabAllowances = await this.usersService.getSplitTabAllowanceSnapshots(sub);
    const canAccessAdmin = role === "super_admin";
    const canAccessData = canAccessAdmin || permissions.includes("data:read");

    return {
      id: sub,
      phone,
      role,
      permissions,
      authMethod: authMethod ?? "local",
      externalMerchant: user?.externalMerchant ?? null,
      externalRef: user?.externalRef ?? null,
      canAccessAdmin,
      canAccessData,
      walletBalanceKES: user?.walletBalanceKES ?? 0,
      walletCurrency: user?.walletCurrency ?? "KES",
      depositAmount: user?.depositAmount ?? "0.00",
      betAmount: user?.betAmount ?? "0.00",
      dailyBetAllowanceTotal: allowance?.total ?? 0,
      dailyBetAllowanceUsed: allowance?.used ?? 0,
      dailyBetAllowanceRemaining: allowance?.remaining ?? 0,
      splitTabAllowances,
    };
  }
}

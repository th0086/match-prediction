import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { MerchantService } from "../merchants/merchant.service";
import { UsersService } from "../users/users.service";

class InviteSuccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  merchant!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  phone!: string;
}

@Controller("callbacks")
export class CallbackController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly merchantService: MerchantService,
  ) {}

  @Post("invite-success")
  @HttpCode(HttpStatus.OK)
  async inviteSuccess(
    @Body() dto: InviteSuccessDto,
    @Headers("x-callback-token") callbackToken?: string,
  ) {
    const expectedToken = (this.configService.get<string>("CALLBACK_TOKEN") ?? "").trim();
    if (!expectedToken) {
      throw new UnauthorizedException("Callback token is not configured.");
    }

    if ((callbackToken ?? "").trim() !== expectedToken) {
      throw new UnauthorizedException("Invalid callback token.");
    }

    const merchant = dto.merchant.trim().toLowerCase();
    if (!this.merchantService.isValidMerchant(merchant)) {
      throw new UnauthorizedException("Invalid merchant.");
    }

    const result = await this.usersService.recordInviteSuccessByPhone(dto.phone, merchant);

    if (!result.found) {
      return {
        success: false,
        message: "User not found.",
      };
    }

    return {
      success: true,
      merchant,
      phone: dto.phone.trim(),
      rewardGranted: result.rewardGranted,
      inviteSuccessCount: result.inviteSuccessCount,
      inviteRewardGrantedCount: result.inviteRewardGrantedCount,
      jackpotIncrementKES: result.jackpotIncrementKES,
      jackpotAmountKES: result.jackpotAmountKES,
      splitTabJackpots: result.splitTabJackpots,
    };
  }
}

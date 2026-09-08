import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { GameService } from "./game/game.service";
import { CreatePredictionDto } from "./predictions/predictions.dto";

@Controller("game")
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get("state")
  async getState(@Query("splitTabId") splitTabId?: string) {
    return this.gameService.getPublicState(splitTabId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("predictions")
  async createPrediction(
    @Req() req: { user: { sub: string } },
    @Body() dto: CreatePredictionDto,
  ) {
    return this.gameService.createPrediction(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-predictions")
  async myPredictions(@Req() req: { user: { sub: string } }) {
    return this.gameService.getPredictionsForUser(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-wallet-credits")
  async myWalletCredits(@Req() req: { user: { sub: string } }) {
    return this.gameService.getWalletCreditsForUser(req.user.sub);
  }
}

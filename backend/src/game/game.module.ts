import { Module } from "@nestjs/common";
import { MatchesModule } from "../matches/matches.module";
import { PredictionsModule } from "../predictions/predictions.module";
import { TeamsModule } from "../teams/teams.module";
import { GameService } from "./game.service";

@Module({
  imports: [TeamsModule, MatchesModule, PredictionsModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
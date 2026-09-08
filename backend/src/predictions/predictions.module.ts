import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JackpotState, JackpotStateSchema } from "../draws/jackpot-state.schema";
import { PayoutRecord, PayoutRecordSchema } from "../draws/payout-record.schema";
import { Match, MatchSchema } from "../matches/match.schema";
import { SplitTab, SplitTabSchema } from "../split-tabs/split-tab.schema";
import { Team, TeamSchema } from "../teams/team.schema";
import { User, UserSchema } from "../users/user.schema";
import { UsersModule } from "../users/users.module";
import { Prediction, PredictionSchema } from "./prediction.schema";
import { PredictionsService } from "./predictions.service";

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Prediction.name, schema: PredictionSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Team.name, schema: TeamSchema },
      { name: JackpotState.name, schema: JackpotStateSchema },
      { name: PayoutRecord.name, schema: PayoutRecordSchema },
      { name: User.name, schema: UserSchema },
      { name: SplitTab.name, schema: SplitTabSchema },
    ]),
  ],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PayoutRecord, PayoutRecordSchema } from "../draws/payout-record.schema";
import { Prediction, PredictionSchema } from "../predictions/prediction.schema";
import { SplitTabsModule } from "../split-tabs/split-tabs.module";
import { SplitTab, SplitTabSchema } from "../split-tabs/split-tab.schema";
import { TeamsModule } from "../teams/teams.module";
import { Match, MatchSchema } from "./match.schema";
import { MatchesService } from "./matches.service";

@Module({
  imports: [
    TeamsModule,
    SplitTabsModule,
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: Prediction.name, schema: PredictionSchema },
      { name: PayoutRecord.name, schema: PayoutRecordSchema },
      { name: SplitTab.name, schema: SplitTabSchema },
    ]),
  ],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
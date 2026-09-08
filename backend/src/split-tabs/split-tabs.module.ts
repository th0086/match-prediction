import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JackpotState, JackpotStateSchema } from "../draws/jackpot-state.schema";
import { Match, MatchSchema } from "../matches/match.schema";
import { SplitTab, SplitTabSchema } from "./split-tab.schema";
import { SplitTabsService } from "./split-tabs.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SplitTab.name, schema: SplitTabSchema },
      { name: Match.name, schema: MatchSchema },
      { name: JackpotState.name, schema: JackpotStateSchema },
    ]),
  ],
  providers: [SplitTabsService],
  exports: [SplitTabsService, MongooseModule],
})
export class SplitTabsModule {}
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminConfig, AdminConfigSchema } from "../admin/admin-config.schema";
import { DrawnNumber, DrawnNumberSchema } from "../draws/drawn-number.schema";
import { JackpotState, JackpotStateSchema } from "../draws/jackpot-state.schema";
import { SplitTab, SplitTabSchema } from "../split-tabs/split-tab.schema";
import { User, UserSchema } from "./user.schema";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DrawnNumber.name, schema: DrawnNumberSchema },
      { name: JackpotState.name, schema: JackpotStateSchema },
      { name: AdminConfig.name, schema: AdminConfigSchema },
      { name: SplitTab.name, schema: SplitTabSchema },
    ]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

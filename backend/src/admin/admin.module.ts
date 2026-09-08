import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { GameModule } from "../game/game.module";
import { SplitTabsModule } from "../split-tabs/split-tabs.module";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import { AdminConfig, AdminConfigSchema } from "./admin-config.schema";
import { AdminController } from "./admin.controller";
import { DataController } from "./data.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [
    AuthModule,
    GameModule,
    SplitTabsModule,
    StorageModule,
    UsersModule,
    MongooseModule.forFeature([{ name: AdminConfig.name, schema: AdminConfigSchema }]),
  ],
  controllers: [AdminController, DataController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

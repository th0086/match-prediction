import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { resolve } from "path";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { CallbackModule } from "./callbacks/callback.module";
import { AuthModule } from "./auth/auth.module";
import { GameModule } from "./game/game.module";
import { GameController } from "./game.controller";
import { MerchantModule } from "./merchants/merchant.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Use deterministic paths to this repository only.
      envFilePath: [
        resolve(__dirname, "../../.env"),
        resolve(__dirname, "../.env"),
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>("MONGODB_URI") ??
          "mongodb://admin:123456@localhost:27017/matchprediction?authSource=admin",
      }),
    }),
    UsersModule,
    MerchantModule,
    CallbackModule,
    AuthModule,
    AdminModule,
    GameModule,
  ],
  controllers: [AppController, GameController],
})
export class AppModule {}

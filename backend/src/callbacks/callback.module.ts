import { Module } from "@nestjs/common";
import { MerchantModule } from "../merchants/merchant.module";
import { UsersModule } from "../users/users.module";
import { CallbackController } from "./callback.controller";
import { CallbackService } from "./callback.service";

@Module({
  imports: [UsersModule, MerchantModule],
  controllers: [CallbackController],
  providers: [CallbackService],
  exports: [CallbackService],
})
export class CallbackModule {}

import { IsMongoId } from "class-validator";

export class CreatePredictionDto {
  @IsMongoId()
  matchId!: string;

  @IsMongoId()
  teamId!: string;
}
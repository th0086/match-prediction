import {
  ArrayMinSize,
  ArrayUnique,
  IsDateString,
  IsBoolean,
  IsIn,
  IsInt,
  IsArray,
  IsMongoId,
  IsOptional,
  Matches,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateJackpotIncrementDto {
  @IsInt()
  @Min(0)
  amount!: number;
}

export class UpdateDataPinDto {
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}

export class VerifyDataPinDto {
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}

export class CreateTeamDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSplitTabDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseJackpotAmountKES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  inviteAmountKES!: number;

  @IsBoolean()
  fixedPredictionModeEnabled!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedPredictionCount?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateSplitTabDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseJackpotAmountKES?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inviteAmountKES?: number;

  @IsOptional()
  @IsBoolean()
  fixedPredictionModeEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fixedPredictionCount?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMatchDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsMongoId({ each: true })
  teamIds!: string[];

  @IsMongoId()
  splitTabId!: string;

  @IsDateString()
  predictionDeadline!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateMatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsDateString()
  predictionDeadline?: string;

  @IsOptional()
  @IsMongoId()
  splitTabId?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class SettleMatchDto {
  @IsMongoId()
  winningTeamId!: string;
}

export class AddMatchPredictionsDto {
  @IsMongoId()
  teamId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;
}

export class WinnersQueryDto {
  @IsOptional()
  @IsMongoId()
  splitTabId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @IsIn(["Locked", "Won", "Lost"])
  status?: "Locked" | "Won" | "Lost";
}

export class InviteStatusQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class PushNumberDataDto {
  @IsString()
  sn!: string;

  @IsInt()
  @Min(0)
  @Max(9)
  number!: number;

  @IsString()
  timestamp!: string;
}

export class PushNumberDto {
  @IsString()
  date!: string;

  @IsNumber()
  created_at!: number;

  @IsString()
  port!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushNumberDataDto)
  data!: PushNumberDataDto;
}

export class CreateEntryDto {
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(9, { each: true })
  numbers!: number[];
}

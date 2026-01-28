import {
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsISO8601,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  customerName?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  serviceId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  servicePriceCents?: number | null;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allDay?: boolean;

  @IsOptional()
  @IsString()
  assignedTeamId?: string | null;

  @IsOptional()
  @IsString()
  rrule?: string | null;
}

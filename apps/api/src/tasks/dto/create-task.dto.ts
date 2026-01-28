import {
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsISO8601,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  customerName: string;

  @IsString()
  @MinLength(1)
  serviceId: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsISO8601()
  startAt: string;

  @IsISO8601()
  endAt: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allDay?: boolean;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  rrule?: string;
}

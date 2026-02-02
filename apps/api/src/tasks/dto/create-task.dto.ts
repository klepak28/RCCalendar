import {
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsISO8601,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  customerName: string;

  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.serviceId !== null && o.serviceId !== '')
  @MinLength(1)
  serviceId?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : Math.round(parsed);
    }
    return typeof value === 'number' ? Math.round(value) : null;
  })
  @ValidateIf((o) => o.servicePriceCents !== null && o.servicePriceCents !== undefined)
  @IsInt()
  @Min(0)
  servicePriceCents?: number | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allDay?: boolean;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.assignedTeamId !== null && o.assignedTeamId !== '')
  assignedTeamId?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.leadSourceId !== null && o.leadSourceId !== '')
  leadSourceId?: string | null;

  @IsOptional()
  @IsString()
  rrule?: string | null;
}

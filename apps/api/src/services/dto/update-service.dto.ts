import { IsString, MinLength, IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceCents?: number;
}

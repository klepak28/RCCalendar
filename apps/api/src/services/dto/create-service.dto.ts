import { IsString, MinLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceCents: number;
}

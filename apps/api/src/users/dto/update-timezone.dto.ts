import { IsString, MinLength } from 'class-validator';

export class UpdateTimezoneDto {
  @IsString()
  @MinLength(1)
  timezone: string;
}

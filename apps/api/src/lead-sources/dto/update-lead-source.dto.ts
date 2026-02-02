import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateLeadSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

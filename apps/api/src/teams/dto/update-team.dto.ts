import { IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'colorHex must be #RRGGBB' })
  colorHex?: string;
}

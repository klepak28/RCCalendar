import { IsString, MinLength, Matches } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'colorHex must be #RRGGBB' })
  colorHex: string;
}

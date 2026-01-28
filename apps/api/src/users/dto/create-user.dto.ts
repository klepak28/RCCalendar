import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

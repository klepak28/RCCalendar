import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.users.findAll();
  }
}

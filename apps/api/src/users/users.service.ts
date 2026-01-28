import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Username already exists');
    const password = bcrypt.hashSync(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password,
        timezone: dto.timezone ?? 'America/Chicago',
      },
      select: { id: true, username: true, timezone: true },
    });
    return user;
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, timezone: true },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, timezone: true },
    });
  }

  async updateTimezone(userId: string, timezone: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { timezone },
      select: { id: true, username: true, timezone: true },
    });
  }
}

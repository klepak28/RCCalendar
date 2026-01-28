import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({ data: dto });
  }

  findAll() {
    return this.prisma.team.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.team.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, dto: UpdateTeamDto) {
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}

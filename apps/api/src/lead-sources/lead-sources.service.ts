import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';

@Injectable()
export class LeadSourcesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateLeadSourceDto) {
    return this.prisma.leadSource.create({ data: dto });
  }

  findAll() {
    return this.prisma.leadSource.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.leadSource.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, dto: UpdateLeadSourceDto) {
    return this.prisma.leadSource.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.leadSource.delete({ where: { id } });
  }
}

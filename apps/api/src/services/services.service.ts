import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }

  findAll() {
    return this.prisma.service.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.service.findUniqueOrThrow({ where: { id } });
  }

  update(id: string, dto: UpdateServiceDto) {
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.service.delete({ where: { id } });
  }
}

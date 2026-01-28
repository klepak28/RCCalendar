import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(private prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    try {
      return this.prisma.customer.create({ data: dto });
    } catch (error: any) {
      if (error?.message?.includes('customer') || error?.code === 'P2001') {
        this.logger.error('Prisma customer model not found. Run: pnpm db:generate');
        throw new Error('Database schema not up to date. Please run: pnpm db:generate && pnpm db:migrate');
      }
      throw error;
    }
  }

  findAll(query?: string) {
    const where = query
      ? {
          fullName: {
            contains: query,
            mode: 'insensitive' as const,
          },
        }
      : {};
    try {
      return this.prisma.customer.findMany({
        where,
        orderBy: { fullName: 'asc' },
      });
    } catch (error: any) {
      if (error?.message?.includes('customer') || error?.code === 'P2001') {
        this.logger.error('Prisma customer model not found. Run: pnpm db:generate');
        throw new Error('Database schema not up to date. Please run: pnpm db:generate && pnpm db:migrate');
      }
      throw error;
    }
  }

  findOne(id: string) {
    try {
      return this.prisma.customer.findUniqueOrThrow({ where: { id } });
    } catch (error: any) {
      if (error?.message?.includes('customer') || error?.code === 'P2001') {
        this.logger.error('Prisma customer model not found. Run: pnpm db:generate');
        throw new Error('Database schema not up to date. Please run: pnpm db:generate && pnpm db:migrate');
      }
      throw error;
    }
  }

  update(id: string, dto: UpdateCustomerDto) {
    try {
      return this.prisma.customer.update({ where: { id }, data: dto });
    } catch (error: any) {
      if (error?.message?.includes('customer') || error?.code === 'P2001') {
        this.logger.error('Prisma customer model not found. Run: pnpm db:generate');
        throw new Error('Database schema not up to date. Please run: pnpm db:generate && pnpm db:migrate');
      }
      throw error;
    }
  }

  remove(id: string) {
    try {
      return this.prisma.customer.delete({ where: { id } });
    } catch (error: any) {
      if (error?.message?.includes('customer') || error?.code === 'P2001') {
        this.logger.error('Prisma customer model not found. Run: pnpm db:generate');
        throw new Error('Database schema not up to date. Please run: pnpm db:generate && pnpm db:migrate');
      }
      throw error;
    }
  }
}

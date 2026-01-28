import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { rrulestr } from 'rrule';
import { addMilliseconds, differenceInMilliseconds } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface TaskOccurrence {
  taskId: string;
  occurrenceStart: string; // ISO
  occurrenceEnd: string;   // ISO
  customerName: string;
  customerId: string | null;
  address: string | null;
  phone: string | null;
  serviceId: string | null;
  service: { id: string; name: string } | null;
  servicePriceCents: number | null;
  description: string | null;
  notes: string | null;
  allDay: boolean;
  assignedTeamId: string | null;
  assignedTeam: { id: string; name: string; colorHex: string } | null;
  createdById: string;
  createdBy: { id: string; username: string };
  rrule: string | null;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(private prisma: PrismaService) {}

  private normalizeOptional<T>(value: T | undefined | null): T | null {
    return value === undefined ? null : value;
  }

  private normalizePrice(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    let num: number;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new BadRequestException('Invalid price format');
      }
      num = parsed;
    } else {
      num = value;
    }
    if (num < 0) {
      throw new BadRequestException('Price must be >= 0');
    }
    return Math.round(num);
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private getDurationMs(task: { startAt: Date; endAt: Date }): number {
    return differenceInMilliseconds(task.endAt, task.startAt);
  }

  private expandRecurring(
    task: {
      id: string;
      startAt: Date;
      endAt: Date;
      allDay: boolean;
      customerName: string;
      customerId: string | null;
      address: string | null;
      phone: string | null;
      serviceId: string | null;
      service: { id: string; name: string } | null;
      servicePriceCents: number | null;
      description: string | null;
      notes: string | null;
      assignedTeamId: string | null;
      assignedTeam: { id: string; name: string; colorHex: string } | null;
      createdById: string;
      createdBy: { id: string; username: string };
      rrule: string | null;
    },
    from: Date,
    to: Date,
  ): TaskOccurrence[] {
    if (!task.rrule) {
      if (task.startAt < to && task.endAt > from) {
        return [
          {
            taskId: task.id,
            occurrenceStart: task.startAt.toISOString(),
            occurrenceEnd: task.endAt.toISOString(),
            customerName: task.customerName,
            customerId: task.customerId,
            address: task.address,
            phone: task.phone,
            serviceId: task.serviceId,
            service: task.service,
            servicePriceCents: task.servicePriceCents,
            description: task.description,
            notes: task.notes,
            allDay: task.allDay,
            assignedTeamId: task.assignedTeamId,
            assignedTeam: task.assignedTeam,
            createdById: task.createdById,
            createdBy: task.createdBy,
            rrule: null,
          },
        ];
      }
      return [];
    }
    const durationMs = this.getDurationMs(task);
    const dtstartStr = task.startAt
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
      .replace('Z', '') + 'Z';
    const fullRule = `DTSTART:${dtstartStr}\nRRULE:${task.rrule}`;
    const rule = rrulestr(fullRule);
    const occDates = rule.between(from, to, true);
    return occDates.map((d) => {
      const start = new Date(d);
      const end = addMilliseconds(start, durationMs);
      return {
        taskId: task.id,
        occurrenceStart: start.toISOString(),
        occurrenceEnd: end.toISOString(),
        customerName: task.customerName,
        customerId: task.customerId,
        address: task.address,
        phone: task.phone,
        serviceId: task.serviceId,
        service: task.service,
        servicePriceCents: task.servicePriceCents,
        description: task.description,
        notes: task.notes,
        allDay: task.allDay,
        assignedTeamId: task.assignedTeamId,
        assignedTeam: task.assignedTeam,
        createdById: task.createdById,
        createdBy: task.createdBy,
        rrule: task.rrule,
      };
    });
  }

  async getInRange(from: Date, to: Date): Promise<TaskOccurrence[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        OR: [
          { rrule: null, startAt: { lt: to }, endAt: { gt: from } },
          { rrule: { not: null } },
        ],
      },
      include: {
        customer: true,
        service: true,
        assignedTeam: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    const out: TaskOccurrence[] = [];
    for (const t of tasks) {
      out.push(...this.expandRecurring(t, from, to));
    }
    return out.sort(
      (a, b) =>
        new Date(a.occurrenceStart).getTime() -
        new Date(b.occurrenceStart).getTime(),
    );
  }

  async create(
    userId: string,
    dto: CreateTaskDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    // Convert ISO-8601 strings to Date objects
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    // Validate dates
    if (isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt date');
    }
    if (isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid endAt date');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    // Normalize serviceId
    const normalizedServiceId = this.normalizeString(dto.serviceId);

    // Normalize and validate price
    const servicePriceCents: number | null = this.normalizePrice(dto.servicePriceCents);
    
    // Validate service exists if provided
    if (normalizedServiceId) {
      try {
        await this.prisma.service.findUniqueOrThrow({
          where: { id: normalizedServiceId },
        });
      } catch (error) {
        if (this.isDev) {
          this.logger.error(`Failed to fetch service ${normalizedServiceId}:`, error);
        }
        throw new BadRequestException(`Service not found: ${normalizedServiceId}`);
      }
    }

    // Handle customer data
    let customerId: string | null = this.normalizeString(dto.customerId);
    let customerName = dto.customerName.trim();
    let address = this.normalizeString(dto.address);
    let phone = this.normalizeString(dto.phone);

    // If customerId is provided, fetch customer and snapshot data
    if (customerId) {
      try {
        const customer = await this.prisma.customer.findUniqueOrThrow({
          where: { id: customerId },
        });
        // Snapshot customer data into task
        customerName = customer.fullName;
        address = customer.address;
        phone = customer.phone;
      } catch (error) {
        if (this.isDev) {
          this.logger.error(`Failed to fetch customer ${customerId}:`, error);
        }
        throw new BadRequestException(`Customer not found: ${customerId}`);
      }
    }

    // Normalize all optional fields
    const normalizedData = {
      customerName,
      customerId,
      address,
      phone,
      serviceId: normalizedServiceId,
      servicePriceCents,
      description: this.normalizeString(dto.description),
      notes: this.normalizeString(dto.notes),
      startAt,
      endAt,
      allDay: dto.allDay ?? false,
      assignedTeamId: this.normalizeString(dto.assignedTeamId),
      createdById: userId,
      rrule: this.normalizeString(dto.rrule),
    };

    if (this.isDev) {
      this.logger.debug('Creating task with normalized data:', {
        ...normalizedData,
        startAt: normalizedData.startAt.toISOString(),
        endAt: normalizedData.endAt.toISOString(),
      });
    }

    try {
      return await this.prisma.task.create({
        data: normalizedData,
        include: {
          customer: true,
          service: true,
          assignedTeam: true,
          createdBy: { select: { id: true, username: true } },
        },
      });
    } catch (error) {
      if (this.isDev) {
        this.logger.error('Prisma create error:', error);
        if (error instanceof Error) {
          this.logger.error('Stack:', error.stack);
        }
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    const servicePriceCents: number | null | undefined = dto.servicePriceCents;
    const normalizedServiceId = dto.serviceId !== undefined 
      ? ((dto.serviceId && dto.serviceId.trim()) ? dto.serviceId : null)
      : undefined;
    
    // Validate service exists if provided
    if (normalizedServiceId) {
      try {
        await this.prisma.service.findUniqueOrThrow({
          where: { id: normalizedServiceId },
        });
      } catch (error) {
        if (this.isDev) {
          this.logger.error(`Failed to fetch service ${normalizedServiceId}:`, error);
        }
        throw new BadRequestException(`Service not found: ${normalizedServiceId}`);
      }
    }
    // Handle customer updates
    let customerId: string | null | undefined = dto.customerId !== undefined
      ? this.normalizeString(dto.customerId)
      : undefined;
    let customerName: string | undefined = dto.customerName;
    let address: string | null | undefined = dto.address !== undefined
      ? this.normalizeString(dto.address)
      : undefined;
    let phone: string | null | undefined = dto.phone !== undefined
      ? this.normalizeString(dto.phone)
      : undefined;

    // If customerId is being set/changed, fetch customer and snapshot data
    if (customerId !== undefined && customerId !== null) {
      try {
        const customer = await this.prisma.customer.findUniqueOrThrow({
          where: { id: customerId },
        });
        // Snapshot customer data into task
        customerName = customer.fullName;
        address = customer.address;
        phone = customer.phone;
      } catch (error) {
        if (this.isDev) {
          this.logger.error(`Failed to fetch customer ${customerId}:`, error);
        }
        throw new BadRequestException(`Customer not found: ${customerId}`);
      }
    }

    const updateData: {
        customerName?: string;
        customerId?: string | null;
        address?: string | null;
        phone?: string | null;
        serviceId?: string | null;
        servicePriceCents?: number | null;
        description?: string | null;
        notes?: string | null;
        startAt?: Date;
        endAt?: Date;
        allDay?: boolean;
        assignedTeamId?: string | null;
        rrule?: string | null;
      } = {};
    
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (normalizedServiceId !== undefined) updateData.serviceId = normalizedServiceId;
    if (servicePriceCents !== undefined) updateData.servicePriceCents = servicePriceCents;
    if (dto.description !== undefined) updateData.description = dto.description ?? null;
    if (dto.notes !== undefined) updateData.notes = dto.notes ?? null;
    
    // Handle date updates with validation
    if (dto.startAt !== undefined) {
      const startAt = new Date(dto.startAt);
      if (isNaN(startAt.getTime())) {
        throw new BadRequestException('Invalid startAt date');
      }
      updateData.startAt = startAt;
    }
    if (dto.endAt !== undefined) {
      const endAt = new Date(dto.endAt);
      if (isNaN(endAt.getTime())) {
        throw new BadRequestException('Invalid endAt date');
      }
      updateData.endAt = endAt;
    }
    
    // Validate endAt > startAt if both are being updated
    if (updateData.startAt && updateData.endAt) {
      if (updateData.endAt <= updateData.startAt) {
        throw new BadRequestException('endAt must be after startAt');
      }
    } else if (updateData.startAt && existing.endAt) {
      if (existing.endAt <= updateData.startAt) {
        throw new BadRequestException('endAt must be after startAt');
      }
    } else if (updateData.endAt && existing.startAt) {
      if (updateData.endAt <= existing.startAt) {
        throw new BadRequestException('endAt must be after startAt');
      }
    }
    
    if (dto.allDay !== undefined) updateData.allDay = dto.allDay;
    if (dto.assignedTeamId !== undefined) updateData.assignedTeamId = (dto.assignedTeamId && dto.assignedTeamId.trim()) ? dto.assignedTeamId : null;
    if (dto.rrule !== undefined) updateData.rrule = dto.rrule;

    return this.prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        service: true,
        assignedTeam: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        service: true,
        assignedTeam: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async remove(id: string) {
    await this.prisma.task.findUniqueOrThrow({ where: { id } });
    return this.prisma.task.delete({ where: { id } });
  }
}

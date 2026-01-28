import { Injectable, NotFoundException } from '@nestjs/common';
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
  serviceId: string;
  service: { id: string; name: string; priceCents: number };
  servicePrice: number;
  address: string | null;
  description: string | null;
  notes: string | null;
  allDay: boolean;
  teamId: string | null;
  team: { id: string; name: string; colorHex: string } | null;
  createdById: string;
  createdBy: { id: string; username: string };
  rrule: string | null;
}

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

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
      serviceId: string;
      service: { id: string; name: string; priceCents: number };
      servicePrice: number;
      address: string | null;
      description: string | null;
      notes: string | null;
      teamId: string | null;
      team: { id: string; name: string; colorHex: string } | null;
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
            serviceId: task.serviceId,
            service: task.service,
            servicePrice: task.servicePrice,
            address: task.address,
            description: task.description,
            notes: task.notes,
            allDay: task.allDay,
            teamId: task.teamId,
            team: task.team,
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
        serviceId: task.serviceId,
        service: task.service,
        servicePrice: task.servicePrice,
        address: task.address,
        description: task.description,
        notes: task.notes,
        allDay: task.allDay,
        teamId: task.teamId,
        team: task.team,
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
        service: true,
        team: true,
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
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: dto.serviceId },
    });
    return this.prisma.task.create({
      data: {
        customerName: dto.customerName,
        serviceId: dto.serviceId,
        servicePrice: service.priceCents,
        address: dto.address ?? undefined,
        description: dto.description ?? undefined,
        notes: dto.notes ?? undefined,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        allDay: dto.allDay ?? false,
        teamId: dto.teamId ?? undefined,
        createdById: userId,
        rrule: dto.rrule ?? undefined,
      },
      include: {
        service: true,
        team: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    let servicePrice = existing.servicePrice;
    if (dto.serviceId && dto.serviceId !== existing.serviceId) {
      const svc = await this.prisma.service.findUniqueOrThrow({
        where: { id: dto.serviceId },
      });
      servicePrice = svc.priceCents;
    }
    return this.prisma.task.update({
      where: { id },
      data: {
        customerName: dto.customerName ?? undefined,
        serviceId: dto.serviceId ?? undefined,
        servicePrice,
        address: dto.address ?? undefined,
        description: dto.description ?? undefined,
        notes: dto.notes ?? undefined,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        allDay: dto.allDay ?? undefined,
        teamId: dto.teamId ?? undefined,
        rrule: dto.rrule === undefined ? undefined : dto.rrule,
      },
      include: {
        service: true,
        team: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        service: true,
        team: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async remove(id: string) {
    await this.prisma.task.findUniqueOrThrow({ where: { id } });
    return this.prisma.task.delete({ where: { id } });
  }
}

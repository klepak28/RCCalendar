import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { rrulestr, RRuleSet, RRule } from 'rrule';
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

  /**
   * Validate rrule before persisting. Rejects EXDATE (must use overrides); ensures rrule parses.
   * RRULE mappings (RFC 5545, rrule lib):
   * - Weekly: FREQ=WEEKLY;INTERVAL=x;BYDAY=MO,TU,...
   * - Monthly day N: FREQ=MONTHLY;INTERVAL=x;BYMONTHDAY=n (n 1-31 or -1 for last day)
   * - Monthly nth weekday: FREQ=MONTHLY;INTERVAL=x;BYDAY=SA;BYSETPOS=2 (2nd Sat), BYSETPOS=-1 for last
   * - Yearly date: FREQ=YEARLY;INTERVAL=x;BYMONTH=m;BYMONTHDAY=d
   * - Yearly nth weekday: FREQ=YEARLY;INTERVAL=x;BYMONTH=m;BYDAY=MO;BYSETPOS=2
   */
  private validateRrule(rrule: string | null, dtstart: Date): void {
    if (!rrule || rrule.trim() === '') return;
    const r = rrule.trim();
    if (r.toLowerCase().includes('exdate')) {
      throw new BadRequestException('EXDATE is not allowed in rrule; use task overrides for exclusions');
    }
    const dtstartStr = dtstart
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
      .replace('Z', '') + 'Z';
    try {
      rrulestr(`DTSTART:${dtstartStr}\nRRULE:${r}`) as RRule;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Invalid rrule: ${msg}`);
    }
  }

  /**
   * Sanitize RRULE string by extracting EXDATE values
   * This handles backward compatibility for tasks that have EXDATE embedded in rrule
   * Returns { cleanRrule: string, extractedExdates: Date[] }
   * 
   * Important: DATE-only exdates (YYYYMMDD) are converted to DateTime matching dtstart time
   */
  private sanitizeRrule(rruleStr: string, dtstart: Date): { cleanRrule: string; extractedExdates: Date[] } {
    if (!rruleStr || (!rruleStr.includes('EXDATE') && !rruleStr.includes('exdate'))) {
      return { cleanRrule: rruleStr, extractedExdates: [] };
    }

    const parts = rruleStr.split(';');
    const rruleParts: string[] = [];
    const extractedExdates: Date[] = [];

    for (const part of parts) {
      const partLower = part.toLowerCase();
      if (partLower.startsWith('exdate=') || partLower.startsWith('exdate:')) {
        // Extract EXDATE values (can be comma-separated)
        const exdateStr = part.substring(part.indexOf('=') + 1); // Remove "EXDATE=" or "EXDATE:"
        const exdateValues = exdateStr.split(',');
        
        for (const exdateValue of exdateValues) {
          try {
            const dateStr = exdateValue.trim();
            let exdate: Date;
            
            if (dateStr.length === 8) {
              // YYYYMMDD format (DATE-only) - convert to DateTime matching dtstart time
              const year = parseInt(dateStr.substring(0, 4), 10);
              const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
              const day = parseInt(dateStr.substring(6, 8), 10);
              
              // Use the same time-of-day as dtstart (in UTC)
              exdate = new Date(Date.UTC(
                year, month, day,
                dtstart.getUTCHours(),
                dtstart.getUTCMinutes(),
                dtstart.getUTCSeconds(),
                dtstart.getUTCMilliseconds()
              ));
              
              if (!isNaN(exdate.getTime())) {
                extractedExdates.push(exdate);
                if (this.isDev) {
                  this.logger.debug(`Extracted DATE-only exdate: ${dateStr} -> ${exdate.toISOString()} (using dtstart time)`);
                }
              }
            } else if (dateStr.length >= 15) {
              // YYYYMMDDTHHMMSSZ format (DateTime)
              const year = parseInt(dateStr.substring(0, 4), 10);
              const month = parseInt(dateStr.substring(4, 6), 10) - 1;
              const day = parseInt(dateStr.substring(6, 8), 10);
              const hour = dateStr.length > 9 ? parseInt(dateStr.substring(9, 11), 10) : 0;
              const minute = dateStr.length > 11 ? parseInt(dateStr.substring(11, 13), 10) : 0;
              const second = dateStr.length > 13 ? parseInt(dateStr.substring(13, 15), 10) : 0;
              
              exdate = new Date(Date.UTC(year, month, day, hour, minute, second));
              if (!isNaN(exdate.getTime())) {
                extractedExdates.push(exdate);
                if (this.isDev) {
                  this.logger.debug(`Extracted DateTime exdate: ${dateStr} -> ${exdate.toISOString()}`);
                }
              }
            } else {
              // Try parsing as ISO string
              exdate = new Date(dateStr);
              if (!isNaN(exdate.getTime())) {
                extractedExdates.push(exdate);
                if (this.isDev) {
                  this.logger.debug(`Extracted ISO exdate: ${dateStr} -> ${exdate.toISOString()}`);
                }
              }
            }
          } catch (error) {
            // Skip invalid EXDATE values
            if (this.isDev) {
              this.logger.warn(`Invalid EXDATE value in rrule: ${exdateValue}, skipping`);
            }
          }
        }
      } else {
        // Keep non-EXDATE parts
        rruleParts.push(part);
      }
    }

    const cleanRrule = rruleParts.join(';');
    
    if (this.isDev && extractedExdates.length > 0) {
      this.logger.debug(`Sanitized rrule: removed ${extractedExdates.length} EXDATE value(s), clean rrule: ${cleanRrule}`);
    }

    return {
      cleanRrule,
      extractedExdates,
    };
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
      exDates: Date[];
      overrides?: Array<{
        originalStartAt: Date;
        customerName: string | null;
        customerId: string | null;
        address: string | null;
        phone: string | null;
        serviceId: string | null;
        service: { id: string; name: string } | null;
        servicePriceCents: number | null;
        description: string | null;
        notes: string | null;
        startAt: Date | null;
        endAt: Date | null;
        allDay: boolean | null;
        assignedTeamId: string | null;
        assignedTeam: { id: string; name: string; colorHex: string } | null;
      }>;
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

    try {
      const durationMs = this.getDurationMs(task);
      const dtstart = task.startAt;

      // Sanitize rrule to extract any embedded EXDATE (backward compatibility)
      // Wrap in try-catch to handle any errors during sanitization
      let cleanRrule: string;
      let extractedExdates: Date[] = [];
      try {
        const sanitized = this.sanitizeRrule(task.rrule || '', dtstart);
        cleanRrule = sanitized.cleanRrule;
        extractedExdates = sanitized.extractedExdates;
      } catch (sanitizeError) {
        // If sanitization fails, log and use original rrule (might still fail, but we'll catch it)
        this.logger.error(`Failed to sanitize RRULE for task ${task.id}: ${task.rrule}`);
        if (sanitizeError instanceof Error) {
          this.logger.error(`Sanitization error: ${sanitizeError.message}`);
        }
        cleanRrule = task.rrule || '';
        extractedExdates = [];
      }
      
      // Build the iCal string for parsing (rrule should be clean, no EXDATE)
      const dtstartStr = dtstart
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
        .replace('Z', '') + 'Z';
      
      const fullRule = `DTSTART:${dtstartStr}\nRRULE:${cleanRrule}`;

      // Parse the base RRULE (should be clean after sanitization)
      // NOTE: We do NOT use RRuleSet.exdate() here - we filter using TaskOverride during expansion
      let baseRule: RRule;
      try {
        baseRule = rrulestr(fullRule) as RRule;
      } catch (parseError) {
        // If parsing fails, log detailed error and re-throw to be caught by outer try-catch
        this.logger.error(`Failed to parse RRULE for task ${task.id} (${task.customerName})`);
        this.logger.error(`Original rrule: ${task.rrule}`);
        this.logger.error(`Sanitized rrule: ${cleanRrule}`);
        this.logger.error(`Full rule string: ${fullRule}`);
        if (parseError instanceof Error) {
          this.logger.error(`Parse error: ${parseError.message}`);
          if (this.isDev && parseError.stack) {
            this.logger.error(`Stack: ${parseError.stack}`);
          }
        }
        throw parseError; // Will be caught by outer try-catch
      }

      // Generate all occurrences from RRULE (no EXDATE filtering here - we filter via TaskOverride)
      const occDates = baseRule.between(from, to, true);
      
      // Log extracted exdates for backward compatibility (legacy data)
      if (extractedExdates.length > 0) {
        this.logger.debug(`Task ${task.id}: Found ${extractedExdates.length} legacy EXDATE(s) in RRULE (will be handled via TaskOverride)`);
      }
      
      // Create maps of overrides by originalStartAt timestamp for quick lookup
      // Use getTime() (number) for reliable comparison instead of ISO strings
      // Extract element type safely even if overrides is optional
      type Override = NonNullable<(typeof task)['overrides']>[number];
      const overrideMap = new Map<number, Override>();
      const deletedOverrideSet = new Set<number>(); // Use Set for deleted timestamps
      
      // Runtime safety: overrides is always included in Prisma queries, but handle undefined just in case
      // Normalize dates to seconds precision for reliable matching
      this.logger.debug(`[EXPAND] Processing ${task.overrides?.length || 0} override(s) for task ${task.id}`);
      
      for (const override of (task.overrides ?? [])) {
        const normalizedDate = new Date(override.originalStartAt);
        normalizedDate.setUTCMilliseconds(0); // Normalize to seconds precision
        const timestamp = normalizedDate.getTime(); // Use timestamp (number) for matching
        const ov = override as { deletedAt?: Date | null };
        if (ov.deletedAt) {
          deletedOverrideSet.add(timestamp);
          this.logger.debug(`[EXPAND] Found deleted override: taskId ${task.id} originalStartAt ${normalizedDate.toISOString()} (timestamp: ${timestamp}) deletedAt ${ov.deletedAt.toISOString()}`);
        } else {
          overrideMap.set(timestamp, override);
        }
      }
      
      if (deletedOverrideSet.size > 0) {
        this.logger.debug(`[EXPAND] Task ${task.id} has ${deletedOverrideSet.size} deleted override(s) to filter`);
        this.logger.debug(`[EXPAND] Deleted timestamps: ${Array.from(deletedOverrideSet).join(', ')}`);
      }
      
      
      // Filter out occurrences that have deletion exceptions (deletedAt is set)
      // Compare using getTime() for exact timestamp matching
      const baseOccs = occDates
        .map((d) => {
          const start = new Date(d);
          const end = addMilliseconds(start, durationMs);
          const normalizedStart = new Date(start);
          normalizedStart.setUTCMilliseconds(0);
          const occurrenceTimestamp = normalizedStart.getTime();
          
          if (deletedOverrideSet.has(occurrenceTimestamp)) {
            this.logger.debug(`[EXPAND] Skipping occurrence due to deleted override: taskId ${task.id} occStart ${normalizedStart.toISOString()} (timestamp: ${occurrenceTimestamp})`);
            return null;
          }
          
          const override = overrideMap.get(occurrenceTimestamp);
          return {
            taskId: task.id,
            occurrenceStart: (override?.startAt || start).toISOString(),
            occurrenceEnd: (override?.endAt || end).toISOString(),
            customerName: override?.customerName ?? task.customerName,
            customerId: override?.customerId ?? task.customerId,
            address: override?.address ?? task.address,
            phone: override?.phone ?? task.phone,
            serviceId: override?.serviceId ?? task.serviceId,
            service: override?.service ?? task.service,
            servicePriceCents: override?.servicePriceCents ?? task.servicePriceCents,
            description: override?.description ?? task.description,
            notes: override?.notes ?? task.notes,
            allDay: override?.allDay ?? task.allDay,
            assignedTeamId: override?.assignedTeamId ?? task.assignedTeamId,
            assignedTeam: override?.assignedTeam ?? task.assignedTeam,
            createdById: task.createdById,
            createdBy: task.createdBy,
            rrule: task.rrule,
          };
        })
        .filter((occ): occ is TaskOccurrence => occ !== null);

      const outputSet = new Set<string>();
      const base: TaskOccurrence[] = [];
      for (const occ of baseOccs) {
        base.push(occ);
        outputSet.add(`${task.id}-${occ.occurrenceStart}`);
      }

      for (const override of (task.overrides ?? [])) {
        const ov = override as { deletedAt?: Date | null; startAt?: Date | null; originalStartAt: Date };
        if (ov.deletedAt) continue;
        const overrideStart = ov.startAt ? new Date(ov.startAt) : null;
        if (!overrideStart || overrideStart < from || overrideStart >= to) continue;
        const key = `${task.id}-${overrideStart.toISOString()}`;
        if (outputSet.has(key)) continue;
        const overrideStartNorm = new Date(overrideStart);
        overrideStartNorm.setUTCMilliseconds(0);
        const overrideEnd = (override as { endAt?: Date | null }).endAt
          ? new Date((override as { endAt: Date }).endAt)
          : addMilliseconds(overrideStartNorm, durationMs);
        base.push({
          taskId: task.id,
          occurrenceStart: overrideStartNorm.toISOString(),
          occurrenceEnd: overrideEnd.toISOString(),
          customerName: override.customerName ?? task.customerName,
          customerId: override.customerId ?? task.customerId,
          address: override.address ?? task.address,
          phone: override.phone ?? task.phone,
          serviceId: override.serviceId ?? task.serviceId,
          service: override.service ?? task.service,
          servicePriceCents: override.servicePriceCents ?? task.servicePriceCents,
          description: override.description ?? task.description,
          notes: override.notes ?? task.notes,
          allDay: override.allDay ?? task.allDay,
          assignedTeamId: override.assignedTeamId ?? task.assignedTeamId,
          assignedTeam: override.assignedTeam ?? task.assignedTeam,
          createdById: task.createdById,
          createdBy: task.createdBy,
          rrule: task.rrule,
        });
        outputSet.add(key);
      }

      return base;
    } catch (error) {
      // CRITICAL: Don't let one malformed recurrence break the entire request
      this.logger.error(`Error expanding recurring task ${task.id}:`, error);
      this.logger.error(`RRULE string: ${task.rrule}`);
      if (error instanceof Error) {
        this.logger.error(`Error message: ${error.message}`);
        this.logger.error(`Error stack: ${error.stack}`);
      }
      // Return empty array - this task won't appear in the calendar
      // but the request will succeed (no 500 error)
      return [];
    }
  }

  async getInRange(from: Date, to: Date): Promise<TaskOccurrence[]> {
    // Validate date inputs
    if (!(from instanceof Date) || isNaN(from.getTime())) {
      throw new BadRequestException('Invalid "from" date');
    }
    if (!(to instanceof Date) || isNaN(to.getTime())) {
      throw new BadRequestException('Invalid "to" date');
    }
    if (from >= to) {
      throw new BadRequestException('"from" date must be before "to" date');
    }

    if (this.isDev) {
      this.logger.debug(`Querying tasks from ${from.toISOString()} to ${to.toISOString()}`);
    }
    
    try {
      const tasks = await this.prisma.task.findMany({
        where: {
          deletedAt: null, // Exclude soft-deleted tasks
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
          overrides: {
            include: {
              customer: true,
              service: true,
              assignedTeam: true,
            },
          },
        },
      });

      // Explicitly fetch overrides for recurring tasks to ensure deleted overrides are loaded
      const recurringIds = tasks.filter(t => t.rrule).map(t => t.id);
      if (recurringIds.length > 0) {
        const overrides = await this.prisma.taskOverride.findMany({
          where: { seriesId: { in: recurringIds } },
          include: { customer: true, service: true, assignedTeam: true },
        });
        const byTask = new Map<string, typeof overrides>();
        for (const o of overrides) {
          const list = byTask.get(o.seriesId) ?? [];
          list.push(o);
          byTask.set(o.seriesId, list);
        }
        for (const t of tasks) {
          if (t.rrule) (t as any).overrides = byTask.get(t.id) ?? [];
        }
      }

      
      if (this.isDev) {
        this.logger.debug(`Found ${tasks.length} task(s) in database`);
      }
      
      const out: TaskOccurrence[] = [];
      for (const t of tasks) {
        // Skip tasks with missing createdBy relation (data integrity issue)
        if (!t.createdBy) {
          if (this.isDev) {
            this.logger.warn(`Task ${t.id} has missing createdBy relation (createdById: ${t.createdById})`);
          }
          continue;
        }
        
        // CRITICAL: Wrap each task expansion in try-catch to prevent one bad task from breaking the entire request
        try {
          const occurrences = this.expandRecurring(t, from, to);
          out.push(...occurrences);
        } catch (error) {
          // Log the error but don't throw - skip this task and continue
          this.logger.error(`Error expanding recurring task ${t.id} (${t.customerName}):`, error);
          if (error instanceof Error) {
            this.logger.error(`Error message: ${error.message}`);
            this.logger.error(`RRULE string: ${t.rrule || '(null)'}`);
            if (this.isDev && error.stack) {
              this.logger.error(`Error stack: ${error.stack}`);
            }
          }
          // Skip this task - it won't appear in the calendar but the request will succeed
          continue;
        }
      }
      
      return out.sort(
        (a, b) =>
          new Date(a.occurrenceStart).getTime() -
          new Date(b.occurrenceStart).getTime(),
      );
    } catch (error) {
      if (this.isDev) {
        this.logger.error('Prisma query error in getInRange:', error);
        if (error instanceof Error) {
          this.logger.error('Stack:', error.stack);
        }
      }
      throw error;
    }
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

    if (dto.rrule != null && dto.rrule !== '') {
      this.validateRrule(dto.rrule, startAt);
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
    // CRITICAL: Validate customerName is not empty (required field)
    if (!dto.customerName || typeof dto.customerName !== 'string' || dto.customerName.trim() === '') {
      throw new BadRequestException('customerName is required and cannot be empty');
    }
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

  async update(
    id: string,
    dto: UpdateTaskDto,
    scope?: 'single' | 'following' | 'all',
    occurrenceStart?: string,
  ) {
    const existing = await this.prisma.task.findUnique({ 
      where: { id, deletedAt: null } 
    });
    if (!existing) throw new NotFoundException('Task not found');

    if (scope && existing.rrule) {
      if ((scope === 'single' || scope === 'following') && !occurrenceStart) {
        throw new BadRequestException('occurrenceStart is required when scope is "single" or "following"');
      }
      const occurrenceDate = occurrenceStart ? new Date(occurrenceStart) : null;
      if (occurrenceDate && isNaN(occurrenceDate.getTime())) {
        throw new BadRequestException('Invalid occurrenceStart date');
      }

      if (scope === 'single' && occurrenceDate) {
        return this.updateSingleOccurrence(existing, dto, occurrenceDate);
      } else if (scope === 'following' && occurrenceDate) {
        // "This and following" - Split series
        return this.updateFollowingOccurrences(existing, dto, occurrenceDate);
      }
      // scope === 'all' falls through to normal update
    }

    // Normal update (non-recurring or scope='all')
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
    if (dto.rrule !== undefined) {
      const dtstart = (dto.startAt ? new Date(dto.startAt) : existing.startAt) as Date;
      if (dto.rrule != null && dto.rrule !== '') {
        this.validateRrule(dto.rrule, dtstart);
      }
      updateData.rrule = dto.rrule;
    }

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

  /**
   * Update a single occurrence of a recurring task (scope='single')
   * Creates or updates a TaskOverride
   */
  private async updateSingleOccurrence(
    existing: { id: string; rrule: string | null },
    dto: UpdateTaskDto,
    occurrenceDate: Date,
  ) {
    const normalizedDate = new Date(occurrenceDate);
    normalizedDate.setUTCMilliseconds(0);

    const overrideData: any = {
      seriesId: existing.id,
      originalStartAt: normalizedDate,
    };

    // Handle customer updates
    if (dto.customerId !== undefined) {
      const customerId = this.normalizeString(dto.customerId);
      if (customerId) {
        const customer = await this.prisma.customer.findUniqueOrThrow({
          where: { id: customerId },
        });
        overrideData.customerId = customerId;
        overrideData.customerName = customer.fullName;
        overrideData.address = customer.address;
        overrideData.phone = customer.phone;
      } else {
        overrideData.customerId = null;
        overrideData.customerName = dto.customerName ?? null;
        overrideData.address = dto.address !== undefined ? this.normalizeString(dto.address) : null;
        overrideData.phone = dto.phone !== undefined ? this.normalizeString(dto.phone) : null;
      }
    } else if (dto.customerName !== undefined || dto.address !== undefined || dto.phone !== undefined) {
      overrideData.customerName = dto.customerName ?? null;
      overrideData.address = dto.address !== undefined ? this.normalizeString(dto.address) : null;
      overrideData.phone = dto.phone !== undefined ? this.normalizeString(dto.phone) : null;
    }

    // Handle other fields
    if (dto.serviceId !== undefined) {
      overrideData.serviceId = dto.serviceId ? this.normalizeString(dto.serviceId) : null;
      if (overrideData.serviceId) {
        await this.prisma.service.findUniqueOrThrow({ where: { id: overrideData.serviceId } });
      }
    }
    if (dto.servicePriceCents !== undefined) overrideData.servicePriceCents = dto.servicePriceCents;
    if (dto.description !== undefined) overrideData.description = dto.description ?? null;
    if (dto.notes !== undefined) overrideData.notes = dto.notes ?? null;
    if (dto.allDay !== undefined) overrideData.allDay = dto.allDay;
    if (dto.assignedTeamId !== undefined) {
      overrideData.assignedTeamId = dto.assignedTeamId ? this.normalizeString(dto.assignedTeamId) : null;
    }

    // Handle date updates
    if (dto.startAt !== undefined) {
      overrideData.startAt = new Date(dto.startAt);
    }
    if (dto.endAt !== undefined) {
      overrideData.endAt = new Date(dto.endAt);
    }

    return this.prisma.taskOverride.upsert({
      where: {
        seriesId_originalStartAt: {
          seriesId: existing.id,
          originalStartAt: normalizedDate,
        },
      },
      create: overrideData,
      update: overrideData,
    });
  }

  /**
   * Update this occurrence and all following (scope='following')
   * Splits the series: adds UNTIL to original, creates new series starting from occurrence
   */
  private async updateFollowingOccurrences(
    existing: any,
    dto: UpdateTaskDto,
    occurrenceDate: Date,
  ) {
    const updatedRrule = this.addUntilToRrule(existing.rrule!, occurrenceDate);
    await this.prisma.task.update({
      where: { id: existing.id },
      data: { rrule: updatedRrule },
    });

    // Create new series starting from occurrence date
    const newSeriesData: any = {
      customerName: dto.customerName ?? existing.customerName,
      customerId: dto.customerId !== undefined ? this.normalizeString(dto.customerId) : existing.customerId,
      address: dto.address !== undefined ? this.normalizeString(dto.address) : existing.address,
      phone: dto.phone !== undefined ? this.normalizeString(dto.phone) : existing.phone,
      serviceId: dto.serviceId !== undefined ? this.normalizeString(dto.serviceId) : existing.serviceId,
      servicePriceCents: dto.servicePriceCents ?? existing.servicePriceCents,
      description: dto.description ?? existing.description,
      notes: dto.notes ?? existing.notes,
      startAt: dto.startAt ? new Date(dto.startAt) : occurrenceDate,
      endAt: dto.endAt ? new Date(dto.endAt) : (() => {
        const duration = existing.endAt.getTime() - existing.startAt.getTime();
        return new Date(occurrenceDate.getTime() + duration);
      })(),
      allDay: dto.allDay ?? existing.allDay,
      assignedTeamId: dto.assignedTeamId !== undefined ? this.normalizeString(dto.assignedTeamId) : existing.assignedTeamId,
      createdById: existing.createdById,
      rrule: existing.rrule, // Same recurrence rule
    };

    // Handle customer snapshot if customerId is provided
    if (newSeriesData.customerId) {
      const customer = await this.prisma.customer.findUniqueOrThrow({
        where: { id: newSeriesData.customerId },
      });
      newSeriesData.customerName = customer.fullName;
      newSeriesData.address = customer.address;
      newSeriesData.phone = customer.phone;
    }

    return this.prisma.task.create({
      data: newSeriesData,
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
      where: { id, deletedAt: null },
      include: {
        service: true,
        assignedTeam: true,
        createdBy: { select: { id: true, username: true } },
        overrides: {
          where: {
            deletedAt: null,
          },
        },
      },
    });
  }

  /**
   * Add an excluded date to the exDates array
   * Normalizes the date to UTC midnight for consistent comparison
   */
  private addExdateToArray(exDates: Date[], occurrenceDate: Date): Date[] {
    // Normalize occurrence date to UTC midnight (start of day)
    const normalizedDate = new Date(occurrenceDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);
    
    // Normalize existing exdates for comparison
    const normalizedExDates = exDates.map(d => {
      const normalized = new Date(d);
      normalized.setUTCHours(0, 0, 0, 0);
      return normalized;
    });
    
    // Check if already excluded (compare by date only, ignoring time)
    const exists = normalizedExDates.some(d => 
      d.getTime() === normalizedDate.getTime()
    );
    
    if (this.isDev && exists) {
      this.logger.debug(`Occurrence ${occurrenceDate.toISOString()} is already in exDates`);
    }
    
    if (!exists) {
      const newExDates = [...exDates, normalizedDate];
      if (this.isDev) {
        this.logger.debug(`Adding exdate: ${normalizedDate.toISOString()}, total exdates: ${newExDates.length}`);
      }
      return newExDates;
    }
    
    if (this.isDev) {
      this.logger.debug(`Exdate already exists, returning existing array (${exDates.length} items)`);
    }
    return exDates;
  }

  /**
   * Add UNTIL to an RRULE string to end the series BEFORE a specific datetime
   * IMPORTANT: UNTIL must be occurrenceStartAt - 1 second to exclude the clicked occurrence
   * This matches Google Calendar behavior: "delete this and following" excludes the clicked occurrence
   */
  private addUntilToRrule(rrule: string, occurrenceStartAt: Date): string {
    // Calculate UNTIL as occurrenceStartAt - 1 second (excludes the clicked occurrence)
    const untilBefore = new Date(occurrenceStartAt);
    untilBefore.setUTCSeconds(untilBefore.getUTCSeconds() - 1);
    
    // Format as iCal datetime: YYYYMMDDTHHMMSSZ
    const untilStr = untilBefore
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
      .replace('Z', '') + 'Z';
    
    if (this.isDev) {
      this.logger.debug(`Setting UNTIL to ${untilStr} (${untilBefore.toISOString()}) to exclude occurrence ${occurrenceStartAt.toISOString()}`);
    }
    
    // Parse existing RRULE
    const parts = rrule.split(';');
    const rruleParts: string[] = [];
    
    for (const part of parts) {
      // Remove existing UNTIL and COUNT (they conflict)
      if (!part.startsWith('UNTIL=') && 
          !part.startsWith('until=') && 
          !part.startsWith('COUNT=') && 
          !part.startsWith('count=')) {
        rruleParts.push(part);
      }
    }
    
    // Add UNTIL
    return [...rruleParts, `UNTIL=${untilStr}`].join(';');
  }

  async remove(
    id: string,
    scope?: 'single' | 'following' | 'all',
    occurrenceStart?: string,
  ) {
    // CRITICAL SAFETY: Validate id is provided and not empty
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException('Task ID is required and must be a valid string');
    }

    const existing = await this.prisma.task.findUnique({ 
      where: { id },
      select: {
        id: true,
        rrule: true,
        exDates: true,
        deletedAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    if (existing.deletedAt) {
      throw new NotFoundException('Task already deleted');
    }

    // CRITICAL SAFETY: For scope-based operations, validate scope is valid
    if (scope && scope !== 'single' && scope !== 'following' && scope !== 'all') {
      throw new BadRequestException(`Invalid scope: ${scope}. Must be 'single', 'following', or 'all'`);
    }

    // Handle scope-based deletes for recurring tasks
    if (scope && existing.rrule) {
      if (scope === 'all') {
        // "All in series" - Soft delete the entire series
        if (this.isDev) {
          this.logger.debug(`Deleting entire series: task ${id}`);
        }
        const deletedAtValue = new Date();
        const result = await this.prisma.task.update({
          where: { id },
          data: { deletedAt: deletedAtValue },
        });
        
        // Verify the deletion actually persisted
        const verify = await this.prisma.task.findUnique({
          where: { id },
          select: { deletedAt: true },
        });
        
        if (!verify || !verify.deletedAt) {
          this.logger.error(`Delete verification failed for series ${id}`);
          throw new BadRequestException('Failed to persist deletion - database update did not take effect');
        }
        
        if (this.isDev) {
          this.logger.debug(`Soft deleted series ${id}, deletedAt: ${result.deletedAt} (verified)`);
        }
        return { id: result.id, deleted: true, changed: 1 };
      }

      if (!occurrenceStart) {
        throw new BadRequestException('occurrenceStart is required for scope-based deletes on recurring tasks');
      }
      const occurrenceDate = new Date(occurrenceStart);
      if (isNaN(occurrenceDate.getTime())) {
        throw new BadRequestException('Invalid occurrenceStart date');
      }

      if (scope === 'single') {
        // "Delete only this occurrence" - Create deletion exception via TaskOverride
        // This is the Google Calendar approach: store exception, not modify rrule
        this.logger.debug(`[DELETE SINGLE] Task ${id}, occurrenceStart raw: ${occurrenceStart}`);
        
        // Parse occurrenceStartAt from ISO string (ensure it's UTC)
        const occurrenceStartAt = new Date(occurrenceStart);
        if (isNaN(occurrenceStartAt.getTime())) {
          throw new BadRequestException(`Invalid occurrenceStart date: ${occurrenceStart}`);
        }
        
        this.logger.debug(`[DELETE SINGLE] Parsed occurrenceStartAt ISO: ${occurrenceStartAt.toISOString()}`);
        this.logger.debug(`[DELETE SINGLE] Parsed occurrenceStartAt timestamp: ${occurrenceStartAt.getTime()}`);
        
        // Normalize occurrenceDate to seconds precision to match RRule-generated occurrences
        // This ensures reliable matching during expansion
        const normalizedOccurrenceDate = new Date(occurrenceStartAt);
        normalizedOccurrenceDate.setUTCMilliseconds(0);
        
        this.logger.debug(`[DELETE SINGLE] Normalized occurrenceStartAt ISO: ${normalizedOccurrenceDate.toISOString()}`);
        this.logger.debug(`[DELETE SINGLE] Normalized occurrenceStartAt timestamp: ${normalizedOccurrenceDate.getTime()}`);
        
        // Upsert TaskOverride with deletedAt set (marks this occurrence as deleted)
        const override = await this.prisma.taskOverride.upsert({
          where: {
            seriesId_originalStartAt: {
              seriesId: id,
              originalStartAt: normalizedOccurrenceDate,
            },
          },
          create: {
            seriesId: id,
            originalStartAt: normalizedOccurrenceDate,
            deletedAt: new Date(), // Mark as deleted
          },
          update: {
            deletedAt: new Date(), // Update deletedAt if override already exists
          },
        });
        
        this.logger.debug(`[DELETE SINGLE] Upserted override with id: ${override.id}`);
        
        // Verify the override was created/updated correctly - query DB to confirm
        const verifyOverride = await this.prisma.taskOverride.findUnique({
          where: {
            seriesId_originalStartAt: {
              seriesId: id,
              originalStartAt: normalizedOccurrenceDate,
            },
          },
        });
        
        if (!verifyOverride) {
          this.logger.error(`[DELETE SINGLE] CRITICAL: Override not found after upsert for taskId ${id} originalStartAt ${normalizedOccurrenceDate.toISOString()}`);
          throw new BadRequestException('Failed to create deletion override - override not found');
        }
        
        if (!verifyOverride.deletedAt) {
          this.logger.error(`[DELETE SINGLE] CRITICAL: Override exists but deletedAt is null for taskId ${id} originalStartAt ${normalizedOccurrenceDate.toISOString()}`);
          throw new BadRequestException('Failed to create deletion override - deletedAt is null');
        }
        
        // Log the saved values from DB
        this.logger.debug(`[DELETE SINGLE] Verified override from DB:`);
        this.logger.debug(`[DELETE SINGLE]   - originalStartAt ISO: ${verifyOverride.originalStartAt.toISOString()}`);
        this.logger.debug(`[DELETE SINGLE]   - originalStartAt timestamp: ${verifyOverride.originalStartAt.getTime()}`);
        this.logger.debug(`[DELETE SINGLE]   - deletedAt ISO: ${verifyOverride.deletedAt.toISOString()}`);
        this.logger.debug(`[DELETE SINGLE]   - isDeleted: ${verifyOverride.deletedAt !== null}`);
        
        // Count total overrides for this series (for logging)
        const overrideCount = await this.prisma.taskOverride.count({
          where: {
            seriesId: id,
            deletedAt: { not: null },
          },
        });
        
        this.logger.debug(`[DELETE SINGLE] Created override isDeleted=true for taskId ${id} originalStartAt ${normalizedOccurrenceDate.toISOString()}, overrideId: ${override.id}, total deleted overrides for series: ${overrideCount}`);
        
        return { id, deleted: true, changed: 1, overrideId: override.id };
      } else if (scope === 'following') {
        // "Delete this and following" - Google Calendar behavior:
        // 1. Set UNTIL to occurrenceStartAt - 1 second (excludes clicked occurrence and all future)
        // 2. Also create deletion exception for the clicked occurrence (safety/reliability)
        // 3. Delete any future overrides
        
        // Check if occurrenceStartAt equals series dtstart (edge case)
        const seriesTask = await this.prisma.task.findUnique({
          where: { id },
          select: { startAt: true },
        });
        
        if (seriesTask && occurrenceDate.getTime() === seriesTask.startAt.getTime()) {
          // Clicked occurrence is the first one - delete entire series
          if (this.isDev) {
            this.logger.debug(`Occurrence ${occurrenceStart} is the series start - deleting entire series`);
          }
          const deletedAtValue = new Date();
          const result = await this.prisma.task.update({
            where: { id },
            data: { deletedAt: deletedAtValue },
          });
          
          const verify = await this.prisma.task.findUnique({
            where: { id },
            select: { deletedAt: true },
          });
          
          if (!verify || !verify.deletedAt) {
            throw new BadRequestException('Failed to persist deletion');
          }
          
          return { id: result.id, deleted: true, changed: 1 };
        }
        
        // Set UNTIL to occurrenceStartAt - 1 second (excludes clicked occurrence)
        // addUntilToRrule already subtracts 1 second, so pass occurrenceDate directly
        const updatedRrule = this.addUntilToRrule(existing.rrule, occurrenceDate);
        
        // Calculate what UNTIL will be (for logging)
        const untilDate = new Date(occurrenceDate);
        untilDate.setUTCSeconds(untilDate.getUTCSeconds() - 1);
        
        this.logger.debug(`[DELETE FOLLOWING] Task ${id}, occurrenceStart: ${occurrenceStart}`);
        this.logger.debug(`[DELETE FOLLOWING] occurrenceStart timestamp: ${occurrenceDate.getTime()}`);
        this.logger.debug(`[DELETE FOLLOWING] UNTIL will be: ${untilDate.toISOString()} (timestamp: ${untilDate.getTime()})`);
        this.logger.debug(`[DELETE FOLLOWING] Updated RRULE: ${updatedRrule}`);
        
        const result = await this.prisma.task.update({
          where: { id },
          data: { rrule: updatedRrule },
        });
        
        // Verify the update persisted
        const verifyTask = await this.prisma.task.findUnique({
          where: { id },
          select: { rrule: true },
        });
        
        if (!verifyTask || verifyTask.rrule !== updatedRrule) {
          this.logger.error(`[DELETE FOLLOWING] CRITICAL: RRULE update verification failed for taskId ${id}`);
          throw new BadRequestException('Failed to update RRULE');
        }
        
        // Normalize occurrenceDate to seconds precision to match RRule-generated occurrences
        const normalizedOccurrenceDate = new Date(occurrenceDate);
        normalizedOccurrenceDate.setUTCMilliseconds(0);
        
        // Create deletion exception for the clicked occurrence (safety/reliability)
        const override = await this.prisma.taskOverride.upsert({
          where: {
            seriesId_originalStartAt: {
              seriesId: id,
              originalStartAt: normalizedOccurrenceDate,
            },
          },
          create: {
            seriesId: id,
            originalStartAt: normalizedOccurrenceDate,
            deletedAt: new Date(),
          },
          update: {
            deletedAt: new Date(),
          },
        });
        
        // Verify override was created
        const verifyOverride = await this.prisma.taskOverride.findUnique({
          where: {
            seriesId_originalStartAt: {
              seriesId: id,
              originalStartAt: normalizedOccurrenceDate,
            },
          },
        });
        
        if (!verifyOverride || !verifyOverride.deletedAt) {
          this.logger.error(`[DELETE FOLLOWING] CRITICAL: Override verification failed for taskId ${id}`);
          throw new BadRequestException('Failed to create deletion override');
        }
        
        if (this.isDev) {
          this.logger.debug(`Created deletion exception for clicked occurrence ${normalizedOccurrenceDate.toISOString()}`);
        }
        
        // Also soft-delete any future overrides (occurrences after the clicked one)
        // Use normalized date for comparison
        const deletedOverrides = await this.prisma.taskOverride.updateMany({
          where: {
            seriesId: id,
            originalStartAt: { gt: normalizedOccurrenceDate },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
        
        if (this.isDev) {
          this.logger.debug(`Updated task ${id} RRULE with UNTIL, created deletion exception, deleted ${deletedOverrides.count} future override(s)`);
        }
        
        return { 
          id: result.id, 
          deleted: true, 
          changed: 1, 
          deletedOverrides: deletedOverrides.count + 1 // +1 for the clicked occurrence exception
        };
      }
    }

    // CRITICAL SAFETY: Normal delete ONLY for one-time tasks (existing.rrule is null)
    // ALWAYS use soft delete - NEVER hard delete
    if (existing.rrule && !scope) {
      throw new BadRequestException('Cannot delete recurring task without scope. Use scope=single, scope=following, or scope=all');
    }

    if (this.isDev) {
      this.logger.debug(`Soft deleting one-time task ${id}`);
    }
    
    const deletedAtValue = new Date();
    const result = await this.prisma.task.update({
      where: { id },
      data: { deletedAt: deletedAtValue },
    });
    
    if (!result.deletedAt) {
      throw new BadRequestException('Failed to delete task - deletedAt was not set');
    }
    
    // Verify the deletion actually persisted
    const verify = await this.prisma.task.findUnique({
      where: { id },
      select: { deletedAt: true },
    });
    
    if (!verify || !verify.deletedAt) {
      this.logger.error(`Delete verification failed for task ${id}`);
      throw new BadRequestException('Failed to persist deletion - database update did not take effect');
    }
    
    if (this.isDev) {
      this.logger.debug(`Soft deleted task ${id}, deletedAt: ${result.deletedAt} (verified)`);
    }
    
    return { id: result.id, deleted: true, changed: 1 };
  }
}

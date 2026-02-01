import { appendFileSync } from 'fs';
import { join } from 'path';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  private readonly logger = new Logger(TasksController.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(private tasks: TasksService) {}

  @Get()
  async getInRange(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Validate required query parameters
    if (!from || !to) {
      throw new BadRequestException('Query parameters "from" and "to" are required (ISO-8601 date strings)');
    }

    // Parse and validate dates
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException(`Invalid "from" date: ${from}. Expected ISO-8601 format (e.g., 2024-01-01T00:00:00.000Z)`);
    }

    if (isNaN(toDate.getTime())) {
      throw new BadRequestException(`Invalid "to" date: ${to}. Expected ISO-8601 format (e.g., 2024-01-31T23:59:59.999Z)`);
    }

    if (fromDate >= toDate) {
      throw new BadRequestException('"from" date must be before "to" date');
    }

    try {
      return await this.tasks.getInRange(fromDate, toDate);
    } catch (error) {
      this.logger.error('Error fetching tasks:', error);
      if (error instanceof Error) {
        this.logger.error('Stack:', error.stack);
      }
      // Re-throw to let PrismaExceptionFilter handle it
      throw error;
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateTaskDto,
  ) {
    if (!user || !user.id) {
      this.logger.error('Task creation failed: No authenticated user');
      throw new UnauthorizedException('Authentication required');
    }

    if (this.isDev) {
      this.logger.debug(`Creating task for user ${user.id}`);
      this.logger.debug(`Request body keys: ${Object.keys(dto).join(', ')}`);
      this.logger.debug(`Request body: ${JSON.stringify(dto, null, 2)}`);
    }

    try {
      return this.tasks.create(user.id, dto);
    } catch (error) {
      this.logger.error('Task creation error:', error);
      if (error instanceof Error) {
        this.logger.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Query('scope') scope: 'single' | 'following' | 'all' | undefined,
    @Query('occurrenceStart') occurrenceStart: string | undefined,
  ) {
    return this.tasks.update(id, dto, scope, occurrenceStart);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string } | null,
    @Query('scope') scope: 'single' | 'following' | 'all' | undefined,
    @Query('occurrenceStart') occurrenceStart: string | undefined,
  ) {
    // Validate occurrenceStartAt is present when scope=single or scope=following
    if ((scope === 'single' || scope === 'following') && !occurrenceStart) {
      throw new BadRequestException('occurrenceStart is required when scope is "single" or "following"');
    }
    
    // Parse and validate occurrenceStartAt
    let occurrenceStartAt: Date | undefined;
    if (occurrenceStart) {
      occurrenceStartAt = new Date(occurrenceStart);
      if (isNaN(occurrenceStartAt.getTime())) {
        throw new BadRequestException(`Invalid occurrenceStart date: ${occurrenceStart}. Expected ISO-8601 format (e.g., 2026-01-29T15:00:00.000Z)`);
      }
    }
    
    // Get user ID from CurrentUser decorator (set by JwtAuthGuard)
    const userId = user?.id || 'unknown';
    
    // #region agent log
    try { const fs=require('fs'); const base=process.cwd().includes('apps')?join(process.cwd(),'..','..'):process.cwd(); const LOG=join(base,'.cursor','debug.log'); fs.mkdirSync(join(base,'.cursor'),{recursive:true}); fs.appendFileSync(LOG, JSON.stringify({location:'DELETE_entry',data:{taskId:id,scope,occurrenceStart,userId},hypothesisId:'H4'})+'\n'); } catch(_){}
    // #endregion
    
    // Enhanced logging for debugging
    this.logger.debug(`[DELETE HANDLER] taskId=${id} scope=${scope} occurrenceStart=${occurrenceStart} userId=${userId}`);
    if (occurrenceStartAt) {
      this.logger.debug(`[DELETE HANDLER] Parsed occurrenceStartAt ISO: ${occurrenceStartAt.toISOString()}`);
      this.logger.debug(`[DELETE HANDLER] Parsed occurrenceStartAt timestamp: ${occurrenceStartAt.getTime()}`);
    }
    
    try {
      const result = await this.tasks.remove(id, scope, occurrenceStart);
      
      // Verify that deletion actually happened
      if (result.changed === 0) {
        this.logger.warn(`Delete operation for task ${id} affected 0 rows`);
        throw new BadRequestException('Delete operation did not change any records');
      }
      
      this.logger.debug(`Delete successful for task ${id}, changed: ${result.changed}`);
      
      return { ok: true, ...result };
    } catch (error) {
      this.logger.error(`Delete failed for task ${id}:`, error);
      if (error instanceof Error) {
        this.logger.error('Stack:', error.stack);
      }
      throw error;
    }
  }
}

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
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasks.remove(id);
  }
}

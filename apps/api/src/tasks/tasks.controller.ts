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
  getInRange(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    return this.tasks.getInRange(fromDate, toDate);
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
      throw new UnauthorizedException('Authentication required');
    }

    if (this.isDev) {
      this.logger.debug(`Creating task for user ${user.id}`);
      this.logger.debug(`Request body keys: ${Object.keys(dto).join(', ')}`);
    }

    return this.tasks.create(user.id, dto);
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

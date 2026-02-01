import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from '../tasks/tasks.service';
import { subYears, addYears } from 'date-fns';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private tasks: TasksService) {}

  @Get()
  async search(
    @Query('query') query: string,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('limit') limitParam: string | undefined,
    @Query('cursor') cursorParam: string | undefined,
  ) {
    const now = new Date();
    const fromDate = fromParam ? new Date(fromParam) : subYears(now, 1);
    const toDate = toParam ? new Date(toParam) : addYears(now, 1);

    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException(
        `Invalid "from" date. Expected ISO-8601 (e.g. ${subYears(now, 1).toISOString()})`,
      );
    }
    if (isNaN(toDate.getTime())) {
      throw new BadRequestException(
        `Invalid "to" date. Expected ISO-8601 (e.g. ${addYears(now, 1).toISOString()})`,
      );
    }
    if (fromDate >= toDate) {
      throw new BadRequestException('"from" date must be before "to" date');
    }

    const limit = limitParam != null ? parseInt(limitParam, 10) : 100;
    if (isNaN(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException('"limit" must be between 1 and 200');
    }

    const offset =
      cursorParam != null && cursorParam !== ''
        ? parseInt(cursorParam, 10)
        : 0;
    if (cursorParam != null && cursorParam !== '' && (isNaN(offset) || offset < 0)) {
      throw new BadRequestException('Invalid "cursor" (must be non-negative integer)');
    }

    const q = (query ?? '').trim();
    if (q.length === 0) {
      return { items: [], nextCursor: null };
    }

    return this.tasks.search(q, fromDate, toDate, limit, offset);
  }
}

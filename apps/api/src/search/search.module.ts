import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [SearchController],
})
export class SearchModule {}

import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchSuggestService } from './search-suggest.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [SearchController],
  providers: [SearchSuggestService],
})
export class SearchModule {}

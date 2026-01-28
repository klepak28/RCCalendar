import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

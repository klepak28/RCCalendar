import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private users: UsersService) {}

  @Get()
  me(@CurrentUser() user: { id: string }) {
    return this.users.findOne(user.id);
  }

  @Patch('timezone')
  updateTimezone(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateTimezoneDto,
  ) {
    return this.users.updateTimezone(user.id, dto.timezone);
  }
}

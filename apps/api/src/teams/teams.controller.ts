import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private teams: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Get()
  findAll() {
    return this.teams.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teams.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }
}

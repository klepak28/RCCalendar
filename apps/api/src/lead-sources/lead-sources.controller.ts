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
import { LeadSourcesService } from './lead-sources.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLeadSourceDto } from './dto/create-lead-source.dto';
import { UpdateLeadSourceDto } from './dto/update-lead-source.dto';

@Controller('lead-sources')
@UseGuards(JwtAuthGuard)
export class LeadSourcesController {
  constructor(private leadSources: LeadSourcesService) {}

  @Post()
  create(@Body() dto: CreateLeadSourceDto) {
    return this.leadSources.create(dto);
  }

  @Get()
  findAll() {
    return this.leadSources.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadSources.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadSourceDto) {
    return this.leadSources.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadSources.remove(id);
  }
}

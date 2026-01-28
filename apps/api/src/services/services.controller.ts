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
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto);
  }

  @Get()
  findAll() {
    return this.services.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.services.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.services.remove(id);
  }
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@CurrentUser() user: { id: string }) {
    const u = await this.auth.validateUser(user.id);
    if (!u) return { user: null };
    return { user: u };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return { message: 'ok' };
  }
}

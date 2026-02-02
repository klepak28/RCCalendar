import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CUSTOMERS = 10;

export interface SuggestCustomer {
  customerId: string;
  name: string;
  phone: string | null;
  address: string | null;
}

@Injectable()
export class SearchSuggestService {
  private readonly logger = new Logger(SearchSuggestService.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(private prisma: PrismaService) {}

  async suggest(q: string): Promise<SuggestCustomer[]> {
    const query = (q ?? '').trim();
    if (query.length === 0) {
      return [];
    }

    const phoneDigits = query.replace(/\D/g, '');

    const orConditions: { fullName?: object; phone?: object; address?: object }[] = [
      { fullName: { contains: query, mode: 'insensitive' as const } },
      { address: { contains: query, mode: 'insensitive' as const } },
    ];
    if (phoneDigits.length > 0) {
      orConditions.push({ phone: { contains: phoneDigits } });
    }

    const raw = await this.prisma.customer.findMany({
      where: { OR: orConditions },
      select: { id: true, fullName: true, phone: true, address: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: 50,
    });

    if (this.isDev) {
      this.logger.debug(
        `SUGGEST q="${query}" rawCount=${raw.length} ids=[${raw.map((r) => r.id).join(', ')}]`,
      );
    }

    const byId = new Map<
      string,
      { id: string; fullName: string; phone: string | null; address: string | null; score: number }
    >();

    for (const c of raw) {
      const phone = c.phone?.trim() || null;
      const address = c.address?.trim() || null;

      if (!phone || !address) {
        if (this.isDev) {
          this.logger.debug(
            `SUGGEST skip id=${c.id} fullName="${c.fullName}" phone=${phone ? 'set' : 'empty'} address=${address ? 'set' : 'empty'}`,
          );
        }
        continue;
      }

      const score = (phone ? 1 : 0) + (address ? 1 : 0);
      const existing = byId.get(c.id);
      if (existing) {
        if (score > existing.score) {
          byId.set(c.id, {
            id: c.id,
            fullName: c.fullName,
            phone,
            address,
            score,
          });
        }
      } else {
        byId.set(c.id, {
          id: c.id,
          fullName: c.fullName,
          phone,
          address,
          score,
        });
      }
    }

    const unique = Array.from(byId.values());
    const result = unique
      .sort((a, b) => {
        const nameCmp = a.fullName.localeCompare(b.fullName);
        if (nameCmp !== 0) return nameCmp;
        return a.id.localeCompare(b.id);
      })
      .slice(0, MAX_CUSTOMERS)
      .map((c) => ({
        customerId: c.id,
        name: c.fullName,
        phone: c.phone,
        address: c.address,
      }));

    if (this.isDev) {
      this.logger.debug(`SUGGEST uniqueCount=${unique.length} returned=${result.length}`);
      for (const c of result) {
        this.logger.debug(`SUGGEST   id=${c.customerId} fullName="${c.name}" phone="${c.phone ?? ''}" address="${c.address ?? ''}"`);
      }
    }

    return result;
  }
}

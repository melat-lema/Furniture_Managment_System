import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { fieldError } from '../common/utils/field-error';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

/** The numbers the owner can change without a developer. */
export const SETTING_DEFS = {
  low_stock_threshold: {
    label: 'Low stock limit',
    description: 'An item counts as "low" when this many or fewer are left in a location.',
    unit: 'items',
    min: 0,
    max: 1000,
    fallback: 3,
  },
  max_discount_percent: {
    label: 'Largest discount a showroom can give',
    description: 'A sale with a bigger discount than this (as a percentage of the price) is refused. 100 means no limit.',
    unit: '%',
    min: 0,
    max: 100,
    fallback: 100,
  },
  payment_reminder_hours: {
    label: 'Remind me about unverified payments after',
    description: 'A payment the owner has not checked for this long is marked overdue (and reminders are sent).',
    unit: 'hours',
    min: 1,
    max: 720,
    fallback: 24,
  },
  payment_escalation_hours: {
    label: 'Escalate unverified payments after',
    description: 'If a payment is still unchecked after this long, the backup approver is told. Must be later than the reminder.',
    unit: 'hours',
    min: 1,
    max: 720,
    fallback: 48,
  },
  sale_void_window_hours: {
    label: 'A showroom can cancel or correct its own sale for',
    description: 'After this many hours only the owner can cancel or change a sale. 0 means showrooms can never do it.',
    unit: 'hours',
    min: 0,
    max: 720,
    fallback: 24,
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
const KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The current value of one setting (or its default if it was never set). */
  async getNumber(key: SettingKey): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const def = SETTING_DEFS[key];
    const value = Number(row?.value);
    return row && Number.isFinite(value) && value >= def.min && value <= def.max ? value : def.fallback;
  }

  async list() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: KEYS } } });
    const stored = new Map(rows.map((row) => [row.key, Number(row.value)]));

    return KEYS.map((key) => {
      const def = SETTING_DEFS[key];
      const value = stored.get(key);
      return {
        key,
        label: def.label,
        description: def.description,
        unit: def.unit,
        min: def.min,
        max: def.max,
        fallback: def.fallback,
        value: value !== undefined && Number.isFinite(value) ? value : def.fallback,
      };
    });
  }

  async update(dto: UpdateSettingsDto, actor: AuthUser, ip: string | null) {
    const before = Object.fromEntries((await this.list()).map((setting) => [setting.key, setting.value]));

    // the escalation must come after the reminder
    const reminder = dto.payment_reminder_hours ?? (await this.getNumber('payment_reminder_hours'));
    const escalation = dto.payment_escalation_hours ?? (await this.getNumber('payment_escalation_hours'));
    if (escalation <= reminder) {
      throw fieldError('payment_escalation_hours', 'This must be later than the reminder time.');
    }

    for (const key of KEYS) {
      const value = dto[key];
      if (value === undefined) continue;
      await this.prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    const after = Object.fromEntries((await this.list()).map((setting) => [setting.key, setting.value]));
    await this.audit.log({
      userId: actor.id,
      action: 'UPDATE',
      tableName: 'Setting',
      recordId: 'settings',
      oldValue: before,
      newValue: after,
      ipAddress: ip,
    });
    return this.list();
  }
}

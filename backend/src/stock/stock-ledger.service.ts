import { ConflictException, Injectable } from '@nestjs/common';
import { ErrorCode } from '../common/constants';
import type { MovementReason } from '../common/types/stock';
import type { Prisma } from '../generated/prisma/client';

export interface MovementInput {
  productId: string;
  locationId: string;
  /** Positive adds stock, negative removes it. Never 0. */
  qtyChange: number;
  reason: MovementReason;
  refType?: string;
  refId?: string;
  note?: string | null;
  userId: string;
  /** Only used to write a friendly "not enough stock" message. */
  productName?: string;
}

/**
 * THE ONLY place where stock changes. Transfers, sales, production and corrections all call
 * this, inside a database transaction, so that:
 *  - every change is written to the ledger (StockMovement) and to the running total (StockLevel) together,
 *  - stock can never go below zero (checked here, and again by a database rule).
 *
 *   await prisma.$transaction(async (tx) => {
 *     await ledger.applyMovement(tx, { ... });
 *   });
 */
@Injectable()
export class StockLedgerService {
  async applyMovement(tx: Prisma.TransactionClient, input: MovementInput): Promise<number> {
    if (!Number.isInteger(input.qtyChange) || input.qtyChange === 0) {
      throw new Error('applyMovement needs a non-zero whole number');
    }

    const key = { productId: input.productId, locationId: input.locationId };
    const current = await tx.stockLevel.findUnique({
      where: { productId_locationId: key },
      select: { quantity: true },
    });
    const before = current?.quantity ?? 0;

    if (before + input.qtyChange < 0) {
      const name = input.productName ? `"${input.productName}"` : 'this product';
      throw new ConflictException({
        code: ErrorCode.INSUFFICIENT_STOCK,
        message: `Not enough stock of ${name}: only ${before} available, so you cannot remove ${Math.abs(input.qtyChange)}.`,
      });
    }

    // increment is done by the database itself, so two people acting at once cannot overwrite each other
    const level = await tx.stockLevel.upsert({
      where: { productId_locationId: key },
      create: { ...key, quantity: input.qtyChange },
      update: { quantity: { increment: input.qtyChange } },
      select: { quantity: true },
    });

    await tx.stockMovement.create({
      data: {
        ...key,
        qtyChange: input.qtyChange,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
        createdById: input.userId,
      },
    });

    return level.quantity;
  }
}

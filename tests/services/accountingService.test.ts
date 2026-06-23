import { AccountingService, QuickBooksGateway } from '../../src/services/accounting/accountingService';

describe('AccountingService', () => {
  it('creates QuickBooks sales receipts only for completed deposits', async () => {
    const gateway: QuickBooksGateway = {
      findSalesReceiptByTransactionId: jest.fn().mockResolvedValue(undefined),
      createSalesReceipt: jest.fn().mockResolvedValue({
        transactionId: 'tx-1',
        quickBooksReceiptId: 'qb-1',
        syncedAt: '2026-06-23T00:00:00.000Z',
      }),
    };

    const result = await new AccountingService(gateway).syncCompletedDeposit({
      id: 'tx-1',
      status: 'COMPLETED',
      amount: 42,
      currency: 'USD',
      customerId: 'customer-1',
      completedAt: '2026-06-23T00:00:00.000Z',
    });

    expect(gateway.createSalesReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'tx-1', customerRef: 'customer-1', currency: 'USD' }),
    );
    expect(result?.quickBooksReceiptId).toBe('qb-1');
  });

  it('skips non-completed deposits', async () => {
    const gateway: QuickBooksGateway = {
      findSalesReceiptByTransactionId: jest.fn(),
      createSalesReceipt: jest.fn(),
    };

    await expect(
      new AccountingService(gateway).syncCompletedDeposit({ id: 'tx-2', status: 'PENDING', amount: 10, currency: 'USD' }),
    ).resolves.toBeUndefined();
    expect(gateway.createSalesReceipt).not.toHaveBeenCalled();
  });
});

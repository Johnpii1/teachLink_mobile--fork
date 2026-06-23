export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;

export interface DepositTransaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  customerId?: string;
  customerName?: string;
  memo?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SalesReceiptLine {
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
}

export interface SalesReceiptPayload {
  transactionId: string;
  customerRef: string;
  currency: string;
  txnDate: string;
  privateNote: string;
  lines: SalesReceiptLine[];
}

export interface SalesReceiptResult {
  transactionId: string;
  quickBooksReceiptId: string;
  syncedAt: string;
}

export interface QuickBooksGateway {
  findSalesReceiptByTransactionId(transactionId: string): Promise<SalesReceiptResult | undefined>;
  createSalesReceipt(payload: SalesReceiptPayload): Promise<SalesReceiptResult>;
}

export class AccountingService {
  constructor(private readonly quickBooksGateway: QuickBooksGateway) {}

  async syncCompletedDeposit(transaction: DepositTransaction): Promise<SalesReceiptResult | undefined> {
    if (transaction.status !== 'COMPLETED') {
      return undefined;
    }

    const existingReceipt = await this.quickBooksGateway.findSalesReceiptByTransactionId(transaction.id);
    if (existingReceipt) {
      return existingReceipt;
    }

    return this.quickBooksGateway.createSalesReceipt(this.toSalesReceiptPayload(transaction));
  }

  private toSalesReceiptPayload(transaction: DepositTransaction): SalesReceiptPayload {
    return {
      transactionId: transaction.id,
      customerRef: transaction.customerId ?? 'walk-up-customer',
      currency: transaction.currency,
      txnDate: transaction.completedAt ?? new Date().toISOString(),
      privateNote: transaction.memo ?? `Deposit ${transaction.id}`,
      lines: [
        {
          description: `Deposit ${transaction.id}`,
          amount: transaction.amount,
          quantity: 1,
          unitPrice: transaction.amount,
        },
      ],
    };
  }
}

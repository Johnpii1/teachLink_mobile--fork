export type StellarAssetCode = 'XLM' | string;

export interface StellarAsset {
  code: StellarAssetCode;
  issuer?: string;
}

export interface ReserveBalance {
  asset: StellarAsset;
  amount: number;
  minimumAmount: number;
  targetAmount: number;
  rebalanceBand?: number;
}

export interface ReserveAccountSnapshot {
  accountId: string;
  balances: ReserveBalance[];
}

export interface RebalanceWarning {
  accountId: string;
  asset: StellarAsset;
  amount: number;
  threshold: number;
  message: string;
}

export interface PathPaymentRequest {
  sourceAccountId: string;
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  sourceAmount: number;
  destinationMin: number;
}

export interface PathPaymentResult {
  transactionHash: string;
  sourceAsset: StellarAsset;
  destinationAsset: StellarAsset;
  sourceAmount: number;
  destinationMin: number;
}

export interface StellarPoolGateway {
  getReserveAccounts(): Promise<ReserveAccountSnapshot[]>;
  getEstimatedDestinationAmount(request: PathPaymentRequest): Promise<number>;
  executeAtomicPathPayment(request: PathPaymentRequest): Promise<PathPaymentResult>;
}

export interface RebalanceServiceOptions {
  maxSlippagePct?: number;
  minimumSwapAmount?: number;
  warningHandler?: (warning: RebalanceWarning) => Promise<void> | void;
}

export interface RebalanceAction {
  accountId: string;
  fromAsset: StellarAsset;
  toAsset: StellarAsset;
  sourceAmount: number;
  destinationMin: number;
  transactionHash: string;
}

export interface RebalanceRunResult {
  checkedAccounts: number;
  warnings: RebalanceWarning[];
  actions: RebalanceAction[];
}

const DEFAULT_MAX_SLIPPAGE_PCT = 0.01;
const DEFAULT_MINIMUM_SWAP_AMOUNT = 0.0000001;

export class LpRebalanceService {
  private readonly maxSlippagePct: number;
  private readonly minimumSwapAmount: number;

  constructor(
    private readonly gateway: StellarPoolGateway,
    private readonly options: RebalanceServiceOptions = {},
  ) {
    this.maxSlippagePct = options.maxSlippagePct ?? DEFAULT_MAX_SLIPPAGE_PCT;
    this.minimumSwapAmount = options.minimumSwapAmount ?? DEFAULT_MINIMUM_SWAP_AMOUNT;
  }

  async runRebalanceCheck(): Promise<RebalanceRunResult> {
    const accounts = await this.gateway.getReserveAccounts();
    const warnings: RebalanceWarning[] = [];
    const actions: RebalanceAction[] = [];

    for (const account of accounts) {
      const accountWarnings = this.findThresholdWarnings(account);
      warnings.push(...accountWarnings);

      for (const warning of accountWarnings) {
        await this.options.warningHandler?.(warning);
      }

      const action = await this.rebalanceAccount(account);
      if (action) {
        actions.push(action);
      }
    }

    return {
      checkedAccounts: accounts.length,
      warnings,
      actions,
    };
  }

  private findThresholdWarnings(account: ReserveAccountSnapshot): RebalanceWarning[] {
    return account.balances
      .filter((balance) => balance.amount < balance.minimumAmount)
      .map((balance) => ({
        accountId: account.accountId,
        asset: balance.asset,
        amount: balance.amount,
        threshold: balance.minimumAmount,
        message: `${this.assetKey(balance.asset)} reserve is below absolute threshold`,
      }));
  }

  private async rebalanceAccount(account: ReserveAccountSnapshot): Promise<RebalanceAction | undefined> {
    const sortedByDelta = [...account.balances].sort(
      (a, b) => this.deltaFromTarget(a) - this.deltaFromTarget(b),
    );
    const deficit = sortedByDelta[0];
    const surplus = sortedByDelta[sortedByDelta.length - 1];

    if (!deficit || !surplus || deficit === surplus) {
      return undefined;
    }

    const deficitAmount = Math.abs(Math.min(0, this.deltaFromTarget(deficit)));
    const surplusAmount = Math.max(0, this.deltaFromTarget(surplus));
    const band = Math.max(deficit.rebalanceBand ?? 0, surplus.rebalanceBand ?? 0);
    const sourceAmount = Math.min(deficitAmount, surplusAmount);

    if (sourceAmount <= band || sourceAmount < this.minimumSwapAmount) {
      return undefined;
    }

    const quoteRequest: PathPaymentRequest = {
      sourceAccountId: account.accountId,
      sourceAsset: surplus.asset,
      destinationAsset: deficit.asset,
      sourceAmount,
      destinationMin: 0,
    };
    const estimatedDestinationAmount = await this.gateway.getEstimatedDestinationAmount(quoteRequest);
    const destinationMin = estimatedDestinationAmount * (1 - this.maxSlippagePct);

    const payment = await this.gateway.executeAtomicPathPayment({
      ...quoteRequest,
      destinationMin,
    });

    return {
      accountId: account.accountId,
      fromAsset: payment.sourceAsset,
      toAsset: payment.destinationAsset,
      sourceAmount: payment.sourceAmount,
      destinationMin: payment.destinationMin,
      transactionHash: payment.transactionHash,
    };
  }

  private deltaFromTarget(balance: ReserveBalance): number {
    return balance.amount - balance.targetAmount;
  }

  private assetKey(asset: StellarAsset): string {
    return asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
  }
}

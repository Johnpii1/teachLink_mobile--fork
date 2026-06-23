import { LpRebalanceService, StellarPoolGateway } from '../../src/services/stellar/lpRebalanceService';

describe('LpRebalanceService', () => {
  it('warns below absolute reserve thresholds and atomically rebalances imbalances', async () => {
    const warningHandler = jest.fn();
    const gateway: StellarPoolGateway = {
      getReserveAccounts: jest.fn().mockResolvedValue([
        {
          accountId: 'GRESERVE',
          balances: [
            { asset: { code: 'USDC', issuer: 'GISSUER' }, amount: 80, minimumAmount: 90, targetAmount: 100 },
            { asset: { code: 'XLM' }, amount: 120, minimumAmount: 10, targetAmount: 100 },
          ],
        },
      ]),
      getEstimatedDestinationAmount: jest.fn().mockResolvedValue(19.5),
      executeAtomicPathPayment: jest.fn().mockResolvedValue({
        transactionHash: 'abc123',
        sourceAsset: { code: 'XLM' },
        destinationAsset: { code: 'USDC', issuer: 'GISSUER' },
        sourceAmount: 20,
        destinationMin: 19.305,
      }),
    };

    const result = await new LpRebalanceService(gateway, { warningHandler }).runRebalanceCheck();

    expect(result.checkedAccounts).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(warningHandler).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'GRESERVE' }));
    expect(gateway.executeAtomicPathPayment).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccountId: 'GRESERVE', sourceAmount: 20, destinationMin: 19.305 }),
    );
    expect(result.actions[0]).toEqual(expect.objectContaining({ transactionHash: 'abc123' }));
  });
});

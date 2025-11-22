import { parseMarketData, normalizeMarketResponse } from '../lib/polymarket';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('Polymarket Lib', () => {
    it('normalizeMarketResponse should handle array input', () => {
        const input = [{ id: '1' }];
        const output = normalizeMarketResponse(input);
        assert.deepStrictEqual(output, input);
    });

    it('normalizeMarketResponse should handle data object input', () => {
        const input = { data: [{ id: '1' }] };
        const output = normalizeMarketResponse(input);
        assert.deepStrictEqual(output, [{ id: '1' }]);
    });

    it('parseMarketData should correctly map markets', () => {
        const markets = [
            {
                conditionId: 'cond1',
                question: 'Will it rain?',
                marketType: 'binary',
                outcomes: JSON.stringify(['Yes', 'No']),
                clobTokenIds: JSON.stringify(['asset1', 'asset2']),
                events: [{ id: 'event1', title: 'Weather' }]
            }
        ];

        const { marketsByCondition, assetIdToOutcome, allAssetIds } = parseMarketData(markets as any);

        assert.strictEqual(marketsByCondition.size, 1);
        assert.strictEqual(assetIdToOutcome.size, 2);
        assert.strictEqual(allAssetIds.length, 2);

        const meta = marketsByCondition.get('cond1');
        assert.strictEqual(meta?.question, 'Will it rain?');
        assert.deepStrictEqual(meta?.outcomes, ['Yes', 'No']);

        const asset1 = assetIdToOutcome.get('asset1');
        assert.strictEqual(asset1?.outcomeLabel, 'Yes');
        assert.strictEqual(asset1?.conditionId, 'cond1');
    });

    it('parseMarketData should handle arrays for outcomes/tokens', () => {
        const markets = [
            {
                conditionId: 'cond2',
                question: 'Who wins?',
                marketType: 'multiple',
                outcomes: ['A', 'B'],
                clobTokenIds: ['t1', 't2'],
                events: []
            }
        ];

        const { marketsByCondition } = parseMarketData(markets as any);
        const meta = marketsByCondition.get('cond2');
        assert.deepStrictEqual(meta?.outcomes, ['A', 'B']);
    });
});


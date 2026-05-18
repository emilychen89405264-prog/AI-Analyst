export const TRADING_STRATEGY_SKILL = `
## Advanced Quant & SMC Trading Strategy Instructions

### 1. Market Structure & SMC (Smart Money Concepts)
- **Identify True Trend**: Only trade in the direction of the 4H/Daily Market Structure. Ignore short-term noise if it contradicts the higher timeframe.
- **Liquidity Sweeps**: Wait for retail liquidity to be swept (Buy Side or Sell Side Liquidity) before entering. Avoid trading standard breakouts; favor entries on the retest or after a sweep.
- **Order Blocks (OB) & FVG**: Entries should ideally align with unmitigated Order Blocks or Fair Value Gaps.

### 2. Gold (XAUUSD) Specific Optimizations (CRITICAL)
- **High Volatility Adjustment**: Gold is highly susceptible to "stop hunts" (wicks). Stop Losses MUST be placed safely below/above the structural swing low/high, leaving enough breathing room (e.g., at least $3-$5 away from entry).
- **Macro Alignment**: Gold trades MUST consider US Dollar Index (DXY) and US Yield trends (from the news data). If USD news is strongly bullish, strictly avoid Gold longs.
- **Avoid Chopping**: If Gold is in a tight range or consolidation, DO NOT force trades. Set recommended_action to "HOLD".

### 3. Synthesize Multiple Signals & Resolution
- **Trend > Sentiment**: Technical Market Structure always overrides short-term market noise.
- **Conflicting Timeframes**: If 15m/1H is bearish but 4H is bullish, recommend HOLD until lower timeframes shift to align with the 4H trend.
- **Strict Entry Filter**: If the setup is not pristine (confidence < 85%), DO NOT issue a BUY/SELL signal. Output HOLD. We prefer missing a trade over taking a low-probability loss.

### 4. Generate eval_note (-1 to 1 scale)
- **Strong Buy Signals (0.8 to 1.0)**: 4H & 1H aligned bullish, price mitigated a discount OB, DXY is weak, news is supportive.
- **Neutral / No Trade (-0.5 to 0.5)**: Choppy market, inside a range, conflicting macro/technicals. (Action MUST be HOLD).
- **Strong Sell (-1.0 to -0.8)**: 4H & 1H aligned bearish, price mitigated a premium OB, DXY is strong.

### 5. Risk & Position Sizing
- **Strict SL Rules**: Never place SL in the middle of a range. SL must logically invalidate the structural thesis.
- **Take Profit (TP)**: Target a minimum 1:1.5 Risk-to-Reward. TP1 should be the nearest major liquidity pool or resistance/support.

### 6. Execution Protocol
- ONLY set recommended_action to 'BUY' or 'SELL' if eval_note is > 0.8 or < -0.8.
- For any score between -0.8 and 0.8, recommended_action MUST be 'HOLD'.
`;

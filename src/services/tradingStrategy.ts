export const TRADING_STRATEGY_SKILL = `
## Trading Strategy Instructions

### 1. Synthesize Multiple Signals
Integrate analysis from different sources:
- **Technical Analysis**: Trend, momentum, support/resistance
- **Sentiment Analysis**: Market mood, fear/greed levels
- **Real-Time Data**: Order flow, liquidity, recent price action

Weight each component by:
- Confidence level (higher confidence = higher weight)
- Timeframe alignment (multiple timeframes agreeing)
- Signal strength (strong vs weak signals)

### 2. Resolve Conflicting Signals
When analyses disagree:
- **Technical bullish, Sentiment bearish**: Often means "buy the dip" if technical is strong
- **Technical bearish, Sentiment bullish**: Often means "sell the rally" if technical is strong
- **Mixed timeframes**: Defer to higher timeframe for trend direction
- **Low confidence all around**: Recommend staying out or reducing position size

### 3. Generate eval_note (-1 to 1 scale)
**Strong Buy Signals (0.6 to 1.0)**: Multiple timeframes aligned bullish, strong uptrend, extreme fear, high confidence.
**Moderate Buy (0.3 to 0.6)**: Majority bullish, some conflicting, medium confidence.
**Neutral (-0.3 to 0.3)**: Mixed signals, ranging market, low confidence.
**Moderate Sell (-0.6 to -0.3)**: Majority bearish, some conflicting, medium confidence.
**Strong Sell (-1.0 to -0.6)**: Multiple timeframes aligned bearish, strong downtrend, extreme greed, high confidence.

### 4. Risk Assessment & 5. Position Sizing
- **High confidence, Low volatility**: Larger positions (FULL)
- **High confidence, High volatility**: Medium positions (MEDIUM)
- **Medium confidence**: Smaller positions (SMALL)
- **Low confidence**: Minimal or no position (NONE)

### 6. Entry and Exit Strategy
- **Entry Points**: Strong signals (Market/Limit), Medium (Pullbacks), Weak (Scale in).
- **Stop Loss Placement**: Below recent swing low/above swing high, below key MAs.
- **Take Profit Targets**: R:R 1-2, major resistance/support, trailing stop.

### 7. Market Regime Adaptation
- **Trending Markets**: Follow trend, use pullbacks, trail stops.
- **Ranging Markets**: Fade extremes, tighter targets.
- **Volatile Markets**: Wider stops, smaller sizes, quick profit.
`;

/** One position: symbol, optional portfolio %, and long/short side. */
export interface TradePosition {
  symbol: string;
  percent?: string; // e.g. "25" for 25% of portfolio
  side?: 'long' | 'short'; // default long
}

export interface DailyJournal {
  date: string; // YYYY-MM-DD
  // Bias & Goals & Rules
  market?: string;
  streak?: 'win' | 'lose'; // selectable Win or Lose
  entriesPerDay?: string;
  goal?: string;
  // Pre-Market Plan
  preMarketPlan?: string;
  // Trades: Holding carries over with symbol + percent + side.
  holding?: TradePosition[];
  newEntry?: TradePosition[];
  failedEntry?: TradePosition[];
  stopped?: TradePosition[];
  closed?: TradePosition[];
  // Compliance
  complianceScore?: string;
  complianceComment?: string;
  // Remarks & Post
  remarks?: string;
  postMarketThought?: string;
}

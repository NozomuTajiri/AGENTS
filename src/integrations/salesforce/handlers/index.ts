/**
 * Salesforce Handlers Export
 */

export { AccountHandler, createAccountHandler } from './AccountHandler';
export type { AccountSearchCriteria, AccountStats } from './AccountHandler';

export { OpportunityHandler, createOpportunityHandler } from './OpportunityHandler';
export type {
  OpportunitySearchCriteria,
  OpportunityPipeline,
  SalesForecast,
} from './OpportunityHandler';

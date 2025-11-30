/**
 * Salesforce Module Exports
 */

export {
  SalesforceRestClient,
  SalesforceMCPClient,
  createSalesforceClient,
} from './mcp/SalesforceMCPClient';

export {
  AccountHandler,
  createAccountHandler,
  OpportunityHandler,
  createOpportunityHandler,
} from './handlers';
export type {
  AccountSearchCriteria,
  AccountStats,
  OpportunitySearchCriteria,
  OpportunityPipeline,
  SalesForecast,
} from './handlers';

export { SalesforceNotifier, createSalesforceNotifier } from './notifications';
export type { NotificationConfig } from './notifications';

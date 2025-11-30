/**
 * Salesforce Commands for Lark Bot
 * LarkからSalesforceを操作するコマンド群
 */

import type { LarkBotCommand, LarkMessageContent, LarkBotCommandParams } from '../../types';
import { SalesforceMCPClient } from '../../salesforce';
import { AccountHandler, OpportunityHandler } from '../../salesforce/handlers';
import { Logger } from '../../common';

/**
 * Salesforce Commands Factory
 */
export function createSalesforceCommands(
  sfClient: SalesforceMCPClient,
  logger?: Logger
): LarkBotCommand[] {
  const log = (logger || Logger.getInstance()).child('SalesforceCommands');
  const accountHandler = new AccountHandler(sfClient.getRest(), log);
  const opportunityHandler = new OpportunityHandler(sfClient.getRest(), log);

  return [
    // Account Commands
    {
      command: 'sf-accounts',
      description: 'List recent Salesforce accounts',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const result = await sfClient.queryAccounts();
        if (!result.success || !result.data) {
          return { text: 'Failed to fetch accounts' };
        }

        const accounts = result.data.records.slice(0, 10);
        if (accounts.length === 0) {
          return { text: 'No accounts found' };
        }

        const lines = ['**Recent Accounts:**', ''];
        for (const acc of accounts) {
          lines.push(`• **${acc.Name}** - ${acc.Type || 'N/A'} (${acc.Industry || 'N/A'})`);
        }

        return { text: lines.join('\n') };
      },
    },

    {
      command: 'sf-account',
      description: 'Get account details (usage: /sf-account <id or name>)',
      handler: async (params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const query = params.args.join(' ');
        if (!query) {
          return { text: 'Please provide an account ID or name. Usage: /sf-account <id or name>' };
        }

        // IDかどうかチェック（Salesforce IDは15または18文字）
        if (query.length === 15 || query.length === 18) {
          const result = await sfClient.getAccount(query);
          if (result.success && result.data) {
            return formatAccountDetails(result.data);
          }
        }

        // 名前で検索
        const searchResult = await accountHandler.search({ name: query });
        if (!searchResult.success || !searchResult.data || searchResult.data.records.length === 0) {
          return { text: `No account found matching: ${query}` };
        }

        const account = searchResult.data.records[0];
        return formatAccountDetails(account);
      },
    },

    {
      command: 'sf-account-stats',
      description: 'Show account statistics',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const stats = await accountHandler.getStats();

        const lines = [
          '**Account Statistics:**',
          '',
          `📊 Total Accounts: **${stats.totalCount}**`,
          '',
          '**By Type:**',
        ];

        for (const [type, count] of Object.entries(stats.byType).slice(0, 5)) {
          lines.push(`  • ${type}: ${count}`);
        }

        lines.push('', '**By Industry:**');
        for (const [industry, count] of Object.entries(stats.byIndustry).slice(0, 5)) {
          lines.push(`  • ${industry}: ${count}`);
        }

        return { text: lines.join('\n') };
      },
    },

    // Opportunity Commands
    {
      command: 'sf-opps',
      description: 'List recent opportunities',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const result = await sfClient.queryOpportunities();
        if (!result.success || !result.data) {
          return { text: 'Failed to fetch opportunities' };
        }

        const opps = result.data.records.slice(0, 10);
        if (opps.length === 0) {
          return { text: 'No opportunities found' };
        }

        const lines = ['**Recent Opportunities:**', ''];
        for (const opp of opps) {
          const amount = opp.Amount ? `$${opp.Amount.toLocaleString()}` : 'N/A';
          lines.push(`• **${opp.Name}** - ${opp.StageName} (${amount})`);
        }

        return { text: lines.join('\n') };
      },
    },

    {
      command: 'sf-pipeline',
      description: 'Show sales pipeline analysis',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const pipeline = await opportunityHandler.getPipeline();

        if (pipeline.length === 0) {
          return { text: 'No open opportunities in pipeline' };
        }

        const lines = ['**Sales Pipeline:**', ''];
        let totalAmount = 0;
        let totalWeighted = 0;

        for (const stage of pipeline) {
          totalAmount += stage.totalAmount;
          totalWeighted += stage.weightedAmount;
          lines.push(`**${stage.stage}** (${stage.count} deals)`);
          lines.push(`  Total: $${stage.totalAmount.toLocaleString()}`);
          lines.push(`  Weighted: $${Math.round(stage.weightedAmount).toLocaleString()}`);
          lines.push('');
        }

        lines.push('---');
        lines.push(`**Total Pipeline:** $${totalAmount.toLocaleString()}`);
        lines.push(`**Weighted Pipeline:** $${Math.round(totalWeighted).toLocaleString()}`);

        return { text: lines.join('\n') };
      },
    },

    {
      command: 'sf-forecast',
      description: 'Show sales forecast (usage: /sf-forecast [year] [quarter])',
      handler: async (params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const year = params.args[0] ? parseInt(params.args[0]) : new Date().getFullYear();
        const quarter = params.args[1] ? parseInt(params.args[1]) : undefined;

        const forecast = await opportunityHandler.getForecast(year, quarter);

        const lines = [
          `**Sales Forecast: ${forecast.period}**`,
          '',
          `✅ Closed Won: **$${forecast.closedWon.toLocaleString()}**`,
          `📈 Pipeline: **$${forecast.pipeline.toLocaleString()}**`,
          `⚖️ Weighted: **$${Math.round(forecast.weighted).toLocaleString()}**`,
          '',
          `📊 ${forecast.opportunities.length} opportunities in period`,
        ];

        return { text: lines.join('\n') };
      },
    },

    {
      command: 'sf-winrate',
      description: 'Show win rate analysis',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const analysis = await opportunityHandler.getWinRateAnalysis();

        const lines = [
          '**Win Rate Analysis:**',
          '',
          `🎯 Overall Win Rate: **${analysis.overallWinRate.toFixed(1)}%**`,
          '',
          '**By Deal Size:**',
        ];

        for (const bucket of analysis.byAmount) {
          const bar = '█'.repeat(Math.round(bucket.winRate / 10));
          lines.push(`  ${bucket.range}: ${bucket.winRate.toFixed(1)}% ${bar} (${bucket.count} deals)`);
        }

        return { text: lines.join('\n') };
      },
    },

    // Search Commands
    {
      command: 'sf-search',
      description: 'Search Salesforce (usage: /sf-search <query>)',
      handler: async (params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const query = params.args.join(' ');
        if (!query) {
          return { text: 'Please provide a search query. Usage: /sf-search <query>' };
        }

        // Accountsを検索
        const accountResult = await accountHandler.search({ name: query });
        const accounts = accountResult.success && accountResult.data
          ? accountResult.data.records.slice(0, 5)
          : [];

        // Opportunitiesを検索
        const oppResult = await opportunityHandler.search({ name: query });
        const opps = oppResult.success && oppResult.data
          ? oppResult.data.records.slice(0, 5)
          : [];

        if (accounts.length === 0 && opps.length === 0) {
          return { text: `No results found for: ${query}` };
        }

        const lines = [`**Search Results for "${query}":**`, ''];

        if (accounts.length > 0) {
          lines.push('**Accounts:**');
          for (const acc of accounts) {
            lines.push(`  • ${acc.Name} (${acc.Type || 'N/A'})`);
          }
          lines.push('');
        }

        if (opps.length > 0) {
          lines.push('**Opportunities:**');
          for (const opp of opps) {
            const amount = opp.Amount ? `$${opp.Amount.toLocaleString()}` : 'N/A';
            lines.push(`  • ${opp.Name} - ${opp.StageName} (${amount})`);
          }
        }

        return { text: lines.join('\n') };
      },
    },

    // Task Commands
    {
      command: 'sf-tasks',
      description: 'List your open tasks',
      handler: async (_params: LarkBotCommandParams): Promise<LarkMessageContent> => {
        const result = await sfClient.queryTasks("Status != 'Completed'");
        if (!result.success || !result.data) {
          return { text: 'Failed to fetch tasks' };
        }

        const tasks = result.data.records.slice(0, 10);
        if (tasks.length === 0) {
          return { text: 'No open tasks found' };
        }

        const lines = ['**Open Tasks:**', ''];
        for (const task of tasks) {
          const priority = task.Priority === 'High' ? '🔴' : task.Priority === 'Medium' ? '🟡' : '🟢';
          const dueDate = task.ActivityDate || 'No due date';
          lines.push(`${priority} **${task.Subject}** - ${dueDate}`);
        }

        return { text: lines.join('\n') };
      },
    },
  ];
}

/**
 * Account詳細をフォーマット
 */
function formatAccountDetails(account: Record<string, unknown>): LarkMessageContent {
  const lines = [
    `**${account.Name}**`,
    '',
    `📋 **Type:** ${account.Type || 'N/A'}`,
    `🏭 **Industry:** ${account.Industry || 'N/A'}`,
    `🌍 **Country:** ${account.BillingCountry || 'N/A'}`,
    `📞 **Phone:** ${account.Phone || 'N/A'}`,
    `🌐 **Website:** ${account.Website || 'N/A'}`,
    '',
    `📝 **Description:** ${account.Description ? String(account.Description).substring(0, 200) + '...' : 'N/A'}`,
  ];

  return { text: lines.join('\n') };
}

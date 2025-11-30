/**
 * Salesforce Notifier
 * SalesforceイベントをLarkに通知
 */

import type {
  Account,
  Opportunity,
  Case,
  LarkInteractiveCard,
  LarkCardElement,
} from '../../types';
import { LarkApiClient } from '../../lark';
import { Logger } from '../../common';

export interface NotificationConfig {
  chatId: string;
  enableAccountNotifications: boolean;
  enableOpportunityNotifications: boolean;
  enableCaseNotifications: boolean;
  opportunityAmountThreshold?: number;
  caseHighPriorityOnly?: boolean;
}

/**
 * Salesforce Notifier
 */
export class SalesforceNotifier {
  private larkClient: LarkApiClient;
  private logger: Logger;
  private config: NotificationConfig;

  constructor(larkClient: LarkApiClient, config: NotificationConfig, logger?: Logger) {
    this.larkClient = larkClient;
    this.config = config;
    this.logger = (logger || Logger.getInstance()).child('SalesforceNotifier');
  }

  /**
   * Account作成通知
   */
  async notifyAccountCreated(account: Account): Promise<void> {
    if (!this.config.enableAccountNotifications) return;

    const card = this.buildAccountCard(account, 'created');
    await this.sendCard(card);
    this.logger.info('Account created notification sent', { accountId: account.Id });
  }

  /**
   * Account更新通知
   */
  async notifyAccountUpdated(account: Account, changedFields?: string[]): Promise<void> {
    if (!this.config.enableAccountNotifications) return;

    const card = this.buildAccountCard(account, 'updated', changedFields);
    await this.sendCard(card);
    this.logger.info('Account updated notification sent', { accountId: account.Id });
  }

  /**
   * Opportunity作成通知
   */
  async notifyOpportunityCreated(opportunity: Opportunity): Promise<void> {
    if (!this.config.enableOpportunityNotifications) return;

    // 金額しきい値チェック
    if (this.config.opportunityAmountThreshold &&
        (opportunity.Amount || 0) < this.config.opportunityAmountThreshold) {
      return;
    }

    const card = this.buildOpportunityCard(opportunity, 'created');
    await this.sendCard(card);
    this.logger.info('Opportunity created notification sent', { opportunityId: opportunity.Id });
  }

  /**
   * Opportunityステージ変更通知
   */
  async notifyOpportunityStageChanged(
    opportunity: Opportunity,
    previousStage: string
  ): Promise<void> {
    if (!this.config.enableOpportunityNotifications) return;

    const card = this.buildOpportunityStageChangeCard(opportunity, previousStage);
    await this.sendCard(card);
    this.logger.info('Opportunity stage change notification sent', {
      opportunityId: opportunity.Id,
      previousStage,
      newStage: opportunity.StageName,
    });
  }

  /**
   * Opportunity成約通知
   */
  async notifyOpportunityWon(opportunity: Opportunity): Promise<void> {
    if (!this.config.enableOpportunityNotifications) return;

    const card = this.buildWonCard(opportunity);
    await this.sendCard(card);
    this.logger.info('Opportunity won notification sent', { opportunityId: opportunity.Id });
  }

  /**
   * Case作成通知
   */
  async notifyCaseCreated(caseRecord: Case): Promise<void> {
    if (!this.config.enableCaseNotifications) return;

    // 高優先度のみ通知
    if (this.config.caseHighPriorityOnly && caseRecord.Priority !== 'High') {
      return;
    }

    const card = this.buildCaseCard(caseRecord, 'created');
    await this.sendCard(card);
    this.logger.info('Case created notification sent', { caseId: caseRecord.Id });
  }

  /**
   * Account カードを構築
   */
  private buildAccountCard(
    account: Account,
    action: 'created' | 'updated',
    changedFields?: string[]
  ): LarkInteractiveCard {
    const elements: LarkCardElement[] = [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Type:** ${account.Type || 'N/A'}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Industry:** ${account.Industry || 'N/A'}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Country:** ${account.BillingCountry || 'N/A'}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Phone:** ${account.Phone || 'N/A'}` },
          },
        ],
      },
    ];

    if (changedFields && changedFields.length > 0) {
      elements.push({
        tag: 'div',
        text: { tag: 'lark_md', content: `**Changed Fields:** ${changedFields.join(', ')}` },
      });
    }

    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: 'View in Salesforce' },
          type: 'primary',
          value: { action: 'view_account', accountId: account.Id },
        },
      ],
    });

    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: `Account ${action === 'created' ? 'Created' : 'Updated'}: ${account.Name}` },
        template: action === 'created' ? 'green' : 'blue',
      },
      elements,
    };
  }

  /**
   * Opportunity カードを構築
   */
  private buildOpportunityCard(opportunity: Opportunity, action: 'created' | 'updated'): LarkInteractiveCard {
    const amount = opportunity.Amount ? `$${opportunity.Amount.toLocaleString()}` : 'N/A';
    const probability = opportunity.Probability ? `${opportunity.Probability}%` : 'N/A';

    const elements: LarkCardElement[] = [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Stage:** ${opportunity.StageName}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Amount:** ${amount}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Probability:** ${probability}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Close Date:** ${opportunity.CloseDate}` },
          },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: 'View in Salesforce' },
            type: 'primary',
            value: { action: 'view_opportunity', opportunityId: opportunity.Id },
          },
        ],
      },
    ];

    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: `Opportunity ${action === 'created' ? 'Created' : 'Updated'}: ${opportunity.Name}` },
        template: 'purple',
      },
      elements,
    };
  }

  /**
   * Opportunityステージ変更カードを構築
   */
  private buildOpportunityStageChangeCard(
    opportunity: Opportunity,
    previousStage: string
  ): LarkInteractiveCard {
    const amount = opportunity.Amount ? `$${opportunity.Amount.toLocaleString()}` : 'N/A';

    const elements: LarkCardElement[] = [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**Stage Change:** ${previousStage} → **${opportunity.StageName}**`,
        },
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Amount:** ${amount}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Close Date:** ${opportunity.CloseDate}` },
          },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: 'View Details' },
            type: 'primary',
            value: { action: 'view_opportunity', opportunityId: opportunity.Id },
          },
        ],
      },
    ];

    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: `Stage Changed: ${opportunity.Name}` },
        template: 'orange',
      },
      elements,
    };
  }

  /**
   * 成約カードを構築
   */
  private buildWonCard(opportunity: Opportunity): LarkInteractiveCard {
    const amount = opportunity.Amount ? `$${opportunity.Amount.toLocaleString()}` : 'N/A';

    const elements: LarkCardElement[] = [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `🎉 **Congratulations!** Deal closed!`,
        },
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Amount:** ${amount}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Close Date:** ${opportunity.CloseDate}` },
          },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: 'Celebrate!' },
            type: 'primary',
            value: { action: 'celebrate', opportunityId: opportunity.Id },
          },
        ],
      },
    ];

    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: `🏆 Deal Won: ${opportunity.Name}` },
        template: 'green',
      },
      elements,
    };
  }

  /**
   * Case カードを構築
   */
  private buildCaseCard(caseRecord: Case, action: 'created' | 'updated'): LarkInteractiveCard {
    const priorityColor = caseRecord.Priority === 'High' ? '🔴' : caseRecord.Priority === 'Medium' ? '🟡' : '🟢';

    const elements: LarkCardElement[] = [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Status:** ${caseRecord.Status}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Priority:** ${priorityColor} ${caseRecord.Priority || 'N/A'}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Type:** ${caseRecord.Type || 'N/A'}` },
          },
          {
            is_short: true,
            text: { tag: 'lark_md', content: `**Origin:** ${caseRecord.Origin || 'N/A'}` },
          },
        ],
      },
    ];

    if (caseRecord.Description) {
      elements.push({
        tag: 'div',
        text: { tag: 'lark_md', content: `**Description:** ${caseRecord.Description.substring(0, 200)}...` },
      });
    }

    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: 'View Case' },
          type: caseRecord.Priority === 'High' ? 'danger' : 'primary',
          value: { action: 'view_case', caseId: caseRecord.Id },
        },
      ],
    });

    return {
      config: { wideScreenMode: true },
      header: {
        title: { tag: 'plain_text', content: `Case ${action === 'created' ? 'Created' : 'Updated'}: ${caseRecord.Subject}` },
        template: caseRecord.Priority === 'High' ? 'red' : 'blue',
      },
      elements,
    };
  }

  /**
   * カード送信
   */
  private async sendCard(card: LarkInteractiveCard): Promise<void> {
    await this.larkClient.sendInteractiveCard(this.config.chatId, card);
  }
}

export function createSalesforceNotifier(
  larkClient: LarkApiClient,
  config: NotificationConfig,
  logger?: Logger
): SalesforceNotifier {
  return new SalesforceNotifier(larkClient, config, logger);
}

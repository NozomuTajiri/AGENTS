/**
 * OAuth認証マネージャー
 * Salesforce/Lark両方のOAuth 2.0フローを管理
 */

import type {
  AuthConfig,
  OAuthToken,
  ApiResponse,
  SalesforceConfig,
  LarkConfig,
} from '../../types';

/**
 * OAuth認証マネージャー基底クラス
 */
export abstract class OAuthManager {
  protected config: AuthConfig;
  protected token: OAuthToken | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * 認証URLを生成
   */
  abstract getAuthorizationUrl(state?: string): string;

  /**
   * 認証コードをトークンに交換
   */
  abstract exchangeCodeForToken(code: string): Promise<OAuthToken>;

  /**
   * トークンをリフレッシュ
   */
  abstract refreshToken(): Promise<OAuthToken>;

  /**
   * 現在のトークンを取得
   */
  getToken(): OAuthToken | null {
    return this.token;
  }

  /**
   * トークンが有効期限切れかチェック
   */
  isTokenExpired(): boolean {
    if (!this.token) return true;
    return new Date() >= this.token.expiresAt;
  }

  /**
   * 有効なトークンを取得（必要に応じてリフレッシュ）
   */
  async getValidToken(): Promise<OAuthToken> {
    if (!this.token) {
      throw new Error('No token available. Please authenticate first.');
    }

    if (this.isTokenExpired() && this.token.refreshToken) {
      return this.refreshToken();
    }

    return this.token;
  }

  /**
   * トークンを設定（外部から復元する場合）
   */
  setToken(token: OAuthToken): void {
    this.token = token;
  }

  /**
   * トークンをクリア
   */
  clearToken(): void {
    this.token = null;
  }
}

/**
 * Salesforce OAuth認証マネージャー
 */
export class SalesforceOAuthManager extends OAuthManager {
  private instanceUrl: string;
  private apiVersion: string;
  private sandbox: boolean;

  constructor(config: SalesforceConfig) {
    super(config);
    this.instanceUrl = config.instanceUrl;
    this.apiVersion = config.apiVersion;
    this.sandbox = config.sandbox ?? false;
  }

  private get authBaseUrl(): string {
    return this.sandbox
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || '',
      scope: this.config.scopes?.join(' ') || 'full refresh_token',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authBaseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri || '',
      code,
    });

    const response = await fetch(`${this.authBaseUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error_description?: string; error?: string };
      throw new Error(`Salesforce OAuth error: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json() as {
      instance_url: string;
      access_token: string;
      refresh_token?: string;
      token_type: string;
      scope?: string;
    };
    this.instanceUrl = data.instance_url;

    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + 7200 * 1000), // 2時間
      tokenType: data.token_type,
      scope: data.scope,
    };

    return this.token;
  }

  async refreshToken(): Promise<OAuthToken> {
    if (!this.token?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.token.refreshToken,
    });

    const response = await fetch(`${this.authBaseUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json() as { error_description?: string; error?: string };
      throw new Error(`Salesforce token refresh error: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      scope?: string;
    };

    this.token = {
      accessToken: data.access_token,
      refreshToken: this.token.refreshToken, // リフレッシュトークンは再発行されない場合がある
      expiresAt: new Date(Date.now() + 7200 * 1000),
      tokenType: data.token_type,
      scope: data.scope,
    };

    return this.token;
  }

  getInstanceUrl(): string {
    return this.instanceUrl;
  }

  getApiVersion(): string {
    return this.apiVersion;
  }
}

/**
 * Lark OAuth認証マネージャー
 */
export class LarkOAuthManager extends OAuthManager {
  private appId: string;
  private appSecret: string;
  private tenantAccessToken: string | null = null;
  private tenantTokenExpiresAt: Date | null = null;

  private static readonly BASE_URL = 'https://open.larksuite.com/open-apis';

  constructor(config: LarkConfig) {
    super(config);
    this.appId = config.appId;
    this.appSecret = config.appSecret;
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.config.redirectUri || '',
      state: state || '',
    });

    return `${LarkOAuthManager.BASE_URL}/authen/v1/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthToken> {
    // まずapp_access_tokenを取得
    await this.getAppAccessToken();

    const response = await fetch(
      `${LarkOAuthManager.BASE_URL}/authen/v1/oidc/access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.tenantAccessToken}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json() as { msg?: string; code?: number };
      throw new Error(`Lark OAuth error: ${errorData.msg || errorData.code}`);
    }

    const data = await response.json() as {
      code: number;
      msg?: string;
      data: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };
    };

    if (data.code !== 0) {
      throw new Error(`Lark OAuth error: ${data.msg}`);
    }

    this.token = {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
      tokenType: 'Bearer',
      scope: data.data.scope,
    };

    return this.token;
  }

  async refreshToken(): Promise<OAuthToken> {
    if (!this.token?.refreshToken) {
      throw new Error('No refresh token available');
    }

    await this.getAppAccessToken();

    const response = await fetch(
      `${LarkOAuthManager.BASE_URL}/authen/v1/oidc/refresh_access_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.tenantAccessToken}`,
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.token.refreshToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json() as { msg?: string; code?: number };
      throw new Error(`Lark token refresh error: ${errorData.msg || errorData.code}`);
    }

    const data = await response.json() as {
      code: number;
      msg?: string;
      data: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };
    };

    if (data.code !== 0) {
      throw new Error(`Lark token refresh error: ${data.msg}`);
    }

    this.token = {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: new Date(Date.now() + data.data.expires_in * 1000),
      tokenType: 'Bearer',
      scope: data.data.scope,
    };

    return this.token;
  }

  /**
   * Tenant Access Tokenを取得（Bot用）
   */
  async getTenantAccessToken(): Promise<string> {
    if (this.tenantAccessToken && this.tenantTokenExpiresAt && new Date() < this.tenantTokenExpiresAt) {
      return this.tenantAccessToken;
    }

    const response = await fetch(
      `${LarkOAuthManager.BASE_URL}/auth/v3/tenant_access_token/internal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get Lark tenant access token');
    }

    const data = await response.json() as {
      code: number;
      msg?: string;
      tenant_access_token: string;
      expire: number;
    };

    if (data.code !== 0) {
      throw new Error(`Lark tenant token error: ${data.msg}`);
    }

    this.tenantAccessToken = data.tenant_access_token;
    this.tenantTokenExpiresAt = new Date(Date.now() + (data.expire - 300) * 1000); // 5分前に期限切れとする

    return this.tenantAccessToken!;
  }

  private async getAppAccessToken(): Promise<void> {
    await this.getTenantAccessToken();
  }
}

/**
 * 認証マネージャーファクトリー
 */
export function createOAuthManager(
  type: 'salesforce',
  config: SalesforceConfig
): SalesforceOAuthManager;
export function createOAuthManager(
  type: 'lark',
  config: LarkConfig
): LarkOAuthManager;
export function createOAuthManager(
  type: 'salesforce' | 'lark',
  config: SalesforceConfig | LarkConfig
): SalesforceOAuthManager | LarkOAuthManager {
  if (type === 'salesforce') {
    return new SalesforceOAuthManager(config as SalesforceConfig);
  }
  return new LarkOAuthManager(config as LarkConfig);
}

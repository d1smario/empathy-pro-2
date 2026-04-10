declare module "oauth-1.0a" {
  type Consumer = { key: string; secret: string };

  type OAuthOptions = {
    consumer: Consumer;
    signature_method?: string;
    hash_function?: (baseString: string, key: string) => string;
    nonce_length?: number;
    version?: string;
    realm?: string;
    last_ampersand?: boolean;
  };

  type RequestOptions = { url: string; method: string; data?: Record<string, unknown> };

  type Token = { key: string; secret: string };

  export default class OAuth {
    constructor(opts: OAuthOptions);
    authorize(request: RequestOptions, token: Token): Record<string, string | number>;
    toHeader(authorized: Record<string, string | number>): { Authorization: string };
  }
}

/** DI token for the alimtalk dealer adapter (solapi today; swap per dealer). */
export const ALIMTALK_PROVIDER = Symbol('ALIMTALK_PROVIDER');

export interface AlimtalkSendInput {
  /** Recipient phone number, digits only (no hyphens). */
  to: string;
  /** Dealer-issued template code (approved by Kakao review). */
  templateCode: string;
  /** Template variables WITHOUT the #{} wrapper — the adapter adds dealer syntax. */
  variables: Record<string, string>;
}

export interface AlimtalkSendResult {
  providerMessageId: string;
  status: string;
}

/**
 * Dealer abstraction: Kakao has no direct alimtalk API, so everything goes
 * through a dealer (솔라피/NHN/알리고/비즈톡…). Keeping the HTTP shape behind
 * this interface is what makes the dealer swappable — and mockable in tests.
 */
export interface AlimtalkProvider {
  send(input: AlimtalkSendInput): Promise<AlimtalkSendResult>;
  getStatus(providerMessageId: string): Promise<string>;
}

// CIRIS TypeScript SDK - Billing Resource

import { BaseResource } from './base';

export interface CreditStatus {
  has_credit: boolean;
  credits_remaining: number;
  free_uses_remaining: number;
  total_uses: number;
  plan_name: string;
  purchase_required: boolean;
  purchase_options?: {
    price_minor: number;
    uses: number;
    currency: string;
  };
}

export interface PurchaseInitiateRequest {
  return_url?: string;
}

export interface PurchaseInitiateResponse {
  payment_id: string;
  client_secret: string;
  amount_minor: number;
  currency: string;
  uses_purchased: number;
  publishable_key: string;
}

export interface PurchaseStatusResponse {
  status: 'succeeded' | 'pending' | 'failed';
  credits_added: number;
  balance_after: number | null;
}

export class BillingResource extends BaseResource {
  /**
   * Get current user's credit status
   * @returns Credit status information
   */
  async getCredits(): Promise<CreditStatus> {
    return this.transport.get<CreditStatus>('/v1/api/credits');
  }

  /**
   * Initiate a purchase flow and get Stripe payment intent
   * @param request Optional return URL for redirect flow
   * @returns Payment information including client secret
   */
  async initiatePurchase(request?: PurchaseInitiateRequest): Promise<PurchaseInitiateResponse> {
    return this.transport.post<PurchaseInitiateResponse>(
      '/v1/api/purchase/initiate',
      request || {}
    );
  }

  /**
   * Check the status of a payment
   * @param paymentId The payment ID to check
   * @returns Payment status and credit information
   */
  async getPurchaseStatus(paymentId: string): Promise<PurchaseStatusResponse> {
    return this.transport.get<PurchaseStatusResponse>(
      `/v1/api/purchase/status/${paymentId}`
    );
  }
}

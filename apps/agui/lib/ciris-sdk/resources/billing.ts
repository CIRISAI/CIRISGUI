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

export type PaymentStatus =
  | 'succeeded'       // Payment complete, credits added
  | 'processing'      // Payment being processed
  | 'pending'         // Awaiting payment confirmation
  | 'requires_payment_method'  // Payment method required
  | 'requires_confirmation'    // Requires confirmation
  | 'requires_action' // User action required (3D Secure)
  | 'failed'          // Payment failed
  | 'canceled'        // Payment canceled
  | 'unknown';        // Status unknown

export interface PurchaseStatusResponse {
  status: PaymentStatus;
  credits_added: number;
  balance_after: number;
}

export class BillingResource extends BaseResource {
  /**
   * Get current user's credit status
   * @returns Credit status information
   */
  async getCredits(): Promise<CreditStatus> {
    return this.transport.get<CreditStatus>('/v1/api/billing/credits');
  }

  /**
   * Initiate a purchase flow and get Stripe payment intent
   * @param request Optional return URL for redirect flow
   * @returns Payment information including client secret
   */
  async initiatePurchase(request?: PurchaseInitiateRequest): Promise<PurchaseInitiateResponse> {
    return this.transport.post<PurchaseInitiateResponse>(
      '/v1/api/billing/purchase/initiate',
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
      `/v1/api/billing/purchase/status/${paymentId}`
    );
  }
}

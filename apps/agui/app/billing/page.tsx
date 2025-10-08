'use client';

import { useState, useEffect } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CIRISClient } from '@/lib/ciris-sdk';

// Types
interface CreditStatus {
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

interface PurchaseResponse {
  payment_id: string;
  client_secret: string;
  amount_minor: number;
  currency: string;
  uses_purchased: number;
  publishable_key: string;
}

type PurchaseStep = 'prompt' | 'payment' | 'processing' | 'success' | 'error';

// Stripe Elements appearance configuration
const stripeElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#3B82F6',
      colorBackground: '#FFFFFF',
      colorText: '#1F2937',
      colorDanger: '#EF4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    }
  }
};

// Credit Balance Component
function CreditBalance({ credits, onPurchaseClick }: {
  credits: CreditStatus | null;
  onPurchaseClick: () => void;
}) {
  if (!credits) {
    return (
      <div className="animate-pulse bg-gray-200 h-20 rounded-lg"></div>
    );
  }

  const isFree = credits.free_uses_remaining > 0;
  const isLow = credits.credits_remaining < 5 && credits.free_uses_remaining === 0;
  const isEmpty = !credits.has_credit;

  let icon = '💵';
  let colorClass = 'text-blue-600 bg-blue-50 border-blue-200';
  let message = `${credits.credits_remaining} credits remaining`;

  if (isFree) {
    icon = '🎁';
    colorClass = credits.free_uses_remaining === 1 ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-green-600 bg-green-50 border-green-200';
    message = `${credits.free_uses_remaining} free tries remaining`;
  } else if (isEmpty) {
    icon = '💳';
    colorClass = 'text-red-600 bg-red-50 border-red-200';
    message = '0 credits remaining';
  } else if (isLow) {
    icon = '⚠️';
    colorClass = 'text-orange-600 bg-orange-50 border-orange-200';
    message = `${credits.credits_remaining} credits remaining`;
  }

  return (
    <div
      className={`${colorClass} border-2 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={() => (isEmpty || isLow) && onPurchaseClick()}
    >
      <div className="flex items-center gap-4">
        <span className="text-5xl">{icon}</span>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{message}</h2>
          <p className="text-sm mt-1">
            {isFree && "Try CIRIS for free! No credit card required."}
            {isEmpty && "Purchase more uses to continue"}
            {isLow && !isFree && "Running low! Purchase more to avoid interruptions"}
            {!isEmpty && !isLow && !isFree && "Click to purchase more"}
          </p>
          {credits.purchase_options && (
            <p className="text-sm font-medium mt-2">
              💰 {credits.purchase_options.uses} uses for ${(credits.purchase_options.price_minor / 100).toFixed(2)}
            </p>
          )}
        </div>
        {(isEmpty || isLow) && (
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            Purchase
          </button>
        )}
      </div>
    </div>
  );
}

// Payment Form Component (uses Stripe Elements)
function PaymentForm({
  purchaseInfo,
  onSuccess,
  onError,
  onCancel
}: {
  purchaseInfo: PurchaseResponse;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        purchaseInfo.client_secret,
        {
          payment_method: {
            card: cardElement,
          }
        }
      );

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      }
    } catch (err) {
      onError('An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Details</h3>
        <p className="text-sm text-gray-600 mb-4">
          {purchaseInfo.uses_purchased} uses for ${(purchaseInfo.amount_minor / 100).toFixed(2)}
        </p>
      </div>

      <div className="border border-gray-300 rounded-lg p-4">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1F2937',
                '::placeholder': {
                  color: '#9CA3AF'
                }
              },
              invalid: {
                color: '#EF4444',
                iconColor: '#EF4444'
              }
            }
          }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>🔒</span>
        <span>Secure payment powered by Stripe</span>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {processing ? 'Processing...' : `Pay $${(purchaseInfo.amount_minor / 100).toFixed(2)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Purchase Modal Component
function PurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  credits
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  credits: CreditStatus | null;
}) {
  const [step, setStep] = useState<PurchaseStep>('prompt');
  const [error, setError] = useState<string | null>(null);
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseResponse | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const initiatePurchase = async () => {
    setStep('payment');

    try {
      const client = new CIRISClient();
      const data = await client.billing.initiatePurchase({
        return_url: window.location.href
      });

      setPurchaseInfo(data);
      setStripePromise(loadStripe(data.publishable_key));

    } catch (err) {
      setError('Failed to initialize payment. Please try again.');
      setStep('error');
    }
  };

  const handlePaymentSuccess = () => {
    setStep('success');
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setStep('error');
  };

  const handleRetry = () => {
    setError(null);
    setStep('prompt');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        {/* Prompt Step */}
        {step === 'prompt' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Continue with CIRIS</h2>
              <p className="text-gray-600 mt-2">
                {credits?.free_uses_remaining === 0
                  ? "You've used your 3 free tries! Purchase more to continue."
                  : "Purchase more uses to continue using CIRIS."}
              </p>
            </div>

            {credits?.purchase_options && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    ${(credits.purchase_options.price_minor / 100).toFixed(2)}
                  </p>
                  <p className="text-gray-700 mt-1">
                    for {credits.purchase_options.uses} uses
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={initiatePurchase}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Purchase {credits?.purchase_options?.uses || 20} uses
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {/* Payment Step */}
        {step === 'payment' && stripePromise && purchaseInfo && (
          <Elements stripe={stripePromise} options={stripeElementsOptions}>
            <PaymentForm
              purchaseInfo={purchaseInfo}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={onClose}
            />
          </Elements>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Processing payment...</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && purchaseInfo && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✓</div>
            <h3 className="text-2xl font-bold text-green-600 mb-2">Purchase Successful!</h3>
            <p className="text-gray-700">
              {purchaseInfo.uses_purchased} uses added to your account
            </p>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="text-center py-8 space-y-6">
            <div className="text-6xl text-red-500">✕</div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h3>
              <p className="text-gray-600">{error}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Need help? <a href="/support" className="text-blue-600 hover:underline">Contact support</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Billing Page
export default function BillingPage() {
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [client] = useState(() => new CIRISClient());

  const loadCredits = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await client.billing.getCredits();
      setCredits(data);
    } catch (err) {
      console.error('Failed to load credits:', err);
      setError('Failed to load credit information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredits();
  }, []);

  const handlePurchaseSuccess = () => {
    loadCredits();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-600 mt-2">Manage your CIRIS credits and purchases</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-xl font-bold text-red-900 mb-2">Connection Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadCredits}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Credit Balance */}
        {!loading && !error && credits && (
          <div className="space-y-6">
            <CreditBalance
              credits={credits}
              onPurchaseClick={() => setShowPurchaseModal(true)}
            />

            {/* Usage Statistics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Usage Statistics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Uses</p>
                  <p className="text-2xl font-bold text-gray-900">{credits.total_uses}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Current Plan</p>
                  <p className="text-2xl font-bold text-gray-900">{credits.plan_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Free Uses</p>
                  <p className="text-2xl font-bold text-gray-900">{credits.free_uses_remaining}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Paid Credits</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {credits.credits_remaining - credits.free_uses_remaining}
                  </p>
                </div>
              </div>
            </div>

            {/* Purchase Options */}
            {credits.purchase_options && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Purchase More Uses</h2>
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-600">
                        ${(credits.purchase_options.price_minor / 100).toFixed(2)}
                      </p>
                      <p className="text-gray-700 mt-1">
                        Get {credits.purchase_options.uses} additional uses
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPurchaseModal(true)}
                      className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
                    >
                      Purchase Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-blue-900 mb-2">💡 About Credits</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Each interaction with CIRIS uses one credit</li>
                <li>• Free tries are provided to new users</li>
                <li>• Purchased credits never expire</li>
                <li>• Secure payments processed by Stripe</li>
              </ul>
            </div>
          </div>
        )}

        {/* Purchase Modal */}
        <PurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          onSuccess={handlePurchaseSuccess}
          credits={credits}
        />
      </div>
    </div>
  );
}

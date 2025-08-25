import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ConsentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details to console with prominent formatting
    console.error('❌❌❌ CONSENT PAGE CRITICAL ERROR ❌❌❌');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Stack:', error.stack);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Show alert to user
    alert(`Critical error in Consent page: ${error.message}\n\nPlease refresh the page or contact support.`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-6">
            <div className="flex items-center mb-4">
              <svg className="h-12 w-12 text-red-600 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-2xl font-bold text-red-600">Consent Page Error</h1>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p className="font-bold">Error Message:</p>
                <p className="font-mono text-sm mt-1">{this.state.error?.message}</p>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <>
                  <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded">
                    <p className="font-bold">Stack Trace:</p>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {this.state.error?.stack}
                    </pre>
                  </div>

                  <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded">
                    <p className="font-bold">Component Stack:</p>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </>
              )}

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
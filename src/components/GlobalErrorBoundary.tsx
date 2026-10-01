import { Component, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, Home, RefreshCw, WifiOff } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isOffline: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline = () => this.setState({ isOffline: false });
  handleOffline = () => this.setState({ isOffline: true });

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Global error caught:', error, errorInfo);
  }

  handleReload = () => {
    // CDO audit: "Go Home is ambiguous inside a multi-surface product --
    // use a contextual destination." This is the app-wide catch-all
    // boundary (no specific section to return to), so /today is the one
    // safe, always-meaningful destination rather than "/" -- a hard
    // reload (not a soft navigate) is deliberate here: the React tree
    // that just threw may be in a genuinely broken state, and a full
    // reload is the one recovery path that doesn't depend on it.
    window.location.href = '/today';
  };

  handleRefresh = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    // Offline banner — non-blocking, shown above content
    const offlineBanner = this.state.isOffline ? (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 animate-slide-down">
        <WifiOff className="h-4 w-4" />
        You're offline. Some features may be unavailable.
      </div>
    ) : null;

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              We're sorry for the inconvenience. The error has been logged and we'll look into it.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-muted rounded-lg text-left text-sm">
                <p className="font-mono text-xs text-destructive break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleReload}>
                <Home className="h-4 w-4 mr-2" />
                Go to Today
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {offlineBanner}
        {this.state.isOffline && <div className="h-10" />}
        {this.props.children}
      </>
    );
  }
}

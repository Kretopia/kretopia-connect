import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Label shown in the fallback ("Money", "Brief", etc) */
  name?: string;
  /** Called when user clicks "Reset" — typically clears that widget's state */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Per-widget guardrail for the draggable Studio Room. If one widget throws,
 * the rest of the room keeps working and the user gets a tiny inline recovery
 * card instead of a white screen.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[StudioWidget${this.props.name ? `:${this.props.name}` : ""}]`, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: undefined });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {this.props.name ? `${this.props.name} widget hiccupped` : "Widget hiccupped"}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The rest of your studio is fine. Try again, or reset your layout from the Studio header.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }
}

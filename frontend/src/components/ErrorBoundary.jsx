import { Component } from "react";
import { Button } from "@/components/ui/button";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      title = "Something went wrong",
      description = "This part of the app crashed. Try reloading the page.",
      nonCritical = false,
      fallback = null,
    } = this.props;

    if (fallback) {
      return fallback;
    }

    return (
      <div
        className={`rounded-xl border p-5 ${
          nonCritical ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"
        }`}
        role="alert"
      >
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {this.state.error?.message ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Error: {this.state.error.message}
          </p>
        ) : null}
        <Button className="mt-4" variant={nonCritical ? "outline" : "default"} onClick={this.handleReload}>
          Reload
        </Button>
      </div>
    );
  }
}

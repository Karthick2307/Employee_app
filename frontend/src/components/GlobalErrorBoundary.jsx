import { Component } from "react";

const DEFAULT_ERROR_MESSAGE =
  "Something went wrong. Please refresh the page or try again in a moment.";

const getMessageFromReason = (reason) => {
  if (!reason) return DEFAULT_ERROR_MESSAGE;
  if (typeof reason === "string") return reason;

  return (
    reason.userMessage ||
    reason.response?.data?.message ||
    reason.message ||
    DEFAULT_ERROR_MESSAGE
  );
};

export default class GlobalErrorBoundary extends Component {
  state = {
    hasRenderError: false,
    message: "",
  };

  componentDidMount() {
    if (typeof window === "undefined") return;

    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;

    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error, errorInfo) {
    console.error("Application render error:", error, errorInfo);
    this.setState({
      hasRenderError: true,
      message: DEFAULT_ERROR_MESSAGE,
    });
  }

  handleWindowError = (event) => {
    const message = getMessageFromReason(event.error || event.message);
    this.setState({ message });
  };

  handleUnhandledRejection = (event) => {
    const message = getMessageFromReason(event.reason);
    this.setState({ message });
  };

  dismissMessage = () => {
    this.setState({ message: "" });
  };

  reloadPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    const { children } = this.props;
    const { hasRenderError, message } = this.state;

    if (hasRenderError) {
      return (
        <main className="global-error-fallback" role="alert">
          <div className="global-error-fallback__panel">
            <h1>We could not load this screen</h1>
            <p>{message || DEFAULT_ERROR_MESSAGE}</p>
            <button type="button" className="btn btn-primary" onClick={this.reloadPage}>
              Reload
            </button>
          </div>
        </main>
      );
    }

    return (
      <>
        {children}
        {message ? (
          <div className="global-error-toast" role="alert" aria-live="assertive">
            <span>{message}</span>
            <button
              type="button"
              className="global-error-toast__close"
              onClick={this.dismissMessage}
              aria-label="Dismiss error message"
            >
              Close
            </button>
          </div>
        ) : null}
      </>
    );
  }
}

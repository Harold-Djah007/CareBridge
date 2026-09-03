import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-wrap">
        <section className="card">
          <span className="eyebrow">Something went wrong</span>
          <h1>This screen could not load</h1>
          <p className="muted">{this.state.error.message}</p>
          <button className="primary-btn" type="button" onClick={() => window.location.assign("/")}>
            Return to home
          </button>
        </section>
      </div>
    );
  }
}

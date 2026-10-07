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
          <p className="muted">Please reload this screen. If it still cannot load, return home and try again.</p>
          <button className="primary-btn" type="button" onClick={() => window.location.assign("/")}>
            Return to home
          </button>
        </section>
      </div>
    );
  }
}

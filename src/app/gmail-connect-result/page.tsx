/**
 * /gmail-connect-result
 *
 * Minimal callback result page shown after the Gmail OAuth flow completes.
 * This page is NOT linked from any portal navigation.
 *
 * Query parameters:
 *   status — "success" | "error"
 *   reason — generic error code (no secrets, no OAuth details)
 *
 * SECURITY:
 *   - Never displays raw Google error details, tokens, or authorization codes.
 *   - The reason parameter is used only to show a generic message category.
 *   - All OAuth details remain server-side.
 */

interface PageProps {
  searchParams: { status?: string; reason?: string };
}

export default function GmailConnectResultPage({ searchParams }: PageProps) {
  const status = searchParams.status;
  const isSuccess = status === "success";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0f172a",
        color: "#f1f5f9",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
          padding: "2rem",
          backgroundColor: "#1e293b",
          borderRadius: "0.75rem",
          border: `1px solid ${isSuccess ? "#22c55e33" : "#ef444433"}`,
        }}
      >
        {/* Status icon */}
        <div
          style={{
            fontSize: "3rem",
            marginBottom: "1rem",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {isSuccess ? "✓" : "✗"}
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            marginBottom: "0.75rem",
            color: isSuccess ? "#4ade80" : "#f87171",
          }}
        >
          {isSuccess ? "Gmail Connected Successfully" : "Connection Failed"}
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: "0.9rem",
            color: "#94a3b8",
            marginBottom: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          {isSuccess
            ? "Your Gmail account has been connected. You can now sync payment emails from this account."
            : "The Gmail connection could not be completed. Please try again or contact your administrator if the problem persists."}
        </p>

        {/* Return link */}
        <a
          href="javascript:history.back()"
          style={{
            display: "inline-block",
            padding: "0.5rem 1.25rem",
            backgroundColor: "#334155",
            color: "#f1f5f9",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.preventDefault();
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
        >
          Return to Previous Page
        </a>
      </div>
    </main>
  );
}

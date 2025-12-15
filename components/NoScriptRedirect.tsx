/**
 * NoScriptRedirect component
 * 
 * Automatically redirects users with JavaScript disabled to the static version.
 * Uses noscript tag with meta refresh for FLOSS-compliant no-JS redirect.
 */

export function NoScriptRedirect() {
  return (
    <noscript>
      <meta httpEquiv="refresh" content="0; url=/static" />
    </noscript>
  );
}


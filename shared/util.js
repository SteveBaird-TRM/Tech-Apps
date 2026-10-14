// Small helpers shared by every page.  Load before the page's own script:
//   <script src="/shared/util.js"></script>
//
// escapeHtml(value) - for text or a quoted attribute value placed in an
//   innerHTML string.  null and undefined become "".
// escapeLike(value) - for a PostgREST ilike/like pattern, so %, _ and \ in
//   user text match themselves instead of acting as wildcards.
(function (root) {
  "use strict";

  var HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return HTML_ENTITIES[c];
    });
  }

  function escapeLike(s) {
    return String(s == null ? "" : s).replace(/[%_\\]/g, "\\$&");
  }

  root.escapeHtml = escapeHtml;
  root.escapeLike = escapeLike;
})(typeof window !== "undefined" ? window : this);

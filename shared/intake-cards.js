// Maps intake_cards rows (real columns) to the card objects the intake pages use.
// Card keys keep their old camelCase names.  Empty values show as "" as before.
(function (root) {
  "use strict";

  // [card key, column name]
  var FIELDS = [
    ["status", "status"],
    ["projectType", "project_type"],
    ["projectTitle", "project_title"],
    ["intake", "intake_source"],
    ["projectNumber", "project_number"],
    ["requestorName", "requestor_name"],
    ["department", "department"],
    ["dateReceived", "date_received"],
    ["dateIpaSent", "date_ipa_sent"],
    ["dateBusinessCaseReceived", "date_business_case_received"],
    ["datePrioritisation", "date_prioritisation"],
    ["promiseDate", "promise_date"],
    ["releaseDate", "release_date"],
    ["strategicScore", "strategic_score"],
    ["operationalScore", "operational_score"],
    ["customerScore", "customer_score"],
    ["commercialScore", "commercial_score"],
    ["annualValue", "annual_value"],
    ["bigThinking", "big_thinking"],
    ["bigThinkingNotes", "big_thinking_notes"],
    ["definedBusinessBenefit", "defined_business_benefit"],
    ["businessBenefit", "business_benefit"],
    ["comments", "comments"],
    ["position", "position"]
  ];

  var NUMBER_KEYS = ["strategicScore", "operationalScore", "customerScore", "commercialScore", "annualValue"];
  var BOOLEAN_KEYS = ["bigThinking", "definedBusinessBenefit"];

  // Select string for supabase-js.  Includes the linked project's name.
  var SELECT = ["id", "project_id", "created_at", "updated_at"]
    .concat(FIELDS.map(function (f) { return f[1]; }))
    .join(", ") + ", projects(canonical_name, description)";

  function rowToCard(row) {
    var card = {
      id: row.id,
      projectId: row.project_id || null,
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    };
    FIELDS.forEach(function (f) {
      var v = row[f[1]];
      if (BOOLEAN_KEYS.indexOf(f[0]) !== -1) card[f[0]] = !!v;
      else if (f[0] === "position") card[f[0]] = Number(v) || 0;
      else card[f[0]] = v == null ? "" : v;
    });
    if (row.projects) {
      card.projectName = row.projects.canonical_name || null;
      card.projectDescription = row.projects.description || null;
    }
    return card;
  }

  function cleanValue(key, v) {
    if (BOOLEAN_KEYS.indexOf(key) !== -1) return !!v;
    if (key === "position") return Number(v) || 0;
    if (v === "" || v == null) return null;
    if (NUMBER_KEYS.indexOf(key) !== -1) {
      var n = Number(v);
      return isNaN(n) ? null : n;
    }
    return v;
  }

  // Card -> row of columns for insert/update.  project_id is included.
  function cardToRow(card) {
    var row = { id: card.id, project_id: card.projectId || null };
    FIELDS.forEach(function (f) { row[f[1]] = cleanValue(f[0], card[f[0]]); });
    return row;
  }

  // Only the columns that differ from the last saved row.
  function changedColumns(prevRow, nextRow) {
    var out = {};
    Object.keys(nextRow).forEach(function (col) {
      if (col === "id") return;
      if (prevRow[col] !== nextRow[col]) out[col] = nextRow[col];
    });
    return out;
  }

  var api = {
    SELECT: SELECT,
    rowToCard: rowToCard,
    cardToRow: cardToRow,
    changedColumns: changedColumns
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IntakeCards = api;
})(typeof window !== "undefined" ? window : this);

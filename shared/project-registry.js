// Find-or-create for rows in public.projects.  Needs /shared/util.js (escapeLike).
//
//   ProjectRegistry.findByName(sb, name, columns)
//       -> Promise<{ data: row | null, error }>
//       Case-insensitive exact match on the trimmed name.  % and _ in the
//       name are matched literally.
//   ProjectRegistry.findOrCreate(sb, name, originApp, columns)
//       -> Promise<{ data: row | null, error, created: boolean }>
//       Looks first, then inserts.  If someone else inserted the same name
//       in between, the unique index rejects the insert (23505) and the row
//       that won is returned instead.
(function (root) {
  "use strict";

  var DEFAULT_COLUMNS = "id, canonical_name";
  var UNIQUE_VIOLATION = "23505";

  function findByName(sb, name, columns) {
    return sb.from("projects")
      .select(columns || DEFAULT_COLUMNS)
      .ilike("canonical_name", root.escapeLike(String(name).trim()))
      .limit(1)
      .then(function (res) {
        if (res.error) return { data: null, error: res.error };
        return { data: (res.data && res.data[0]) || null, error: null };
      });
  }

  function findOrCreate(sb, name, originApp, columns) {
    var trimmed = String(name).trim();
    var cols = columns || DEFAULT_COLUMNS;
    return findByName(sb, trimmed, cols).then(function (found) {
      if (found.error || found.data) return { data: found.data, error: found.error, created: false };
      return sb.from("projects")
        .insert({ canonical_name: trimmed, origin_app: originApp })
        .select(cols)
        .single()
        .then(function (ins) {
          if (!ins.error) return { data: ins.data, error: null, created: true };
          if (ins.error.code !== UNIQUE_VIOLATION) return { data: null, error: ins.error, created: false };
          return findByName(sb, trimmed, cols).then(function (again) {
            return { data: again.data, error: again.data ? null : (again.error || ins.error), created: false };
          });
        });
    });
  }

  root.ProjectRegistry = { findByName: findByName, findOrCreate: findOrCreate };
})(typeof window !== "undefined" ? window : this);

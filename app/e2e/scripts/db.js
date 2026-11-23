// Database checks from inside a Maestro flow (Maestro's GraalJS: http, json, output; no sleep).
// Signs in as the Claude account with SB_URL, SB_KEY, E2E_EMAIL, E2E_PASSWORD (passed by run.sh with -e,
// never written in a flow). Throws, and so fails the step, when a check is not met within TIMEOUT
// seconds (default 15).
//
// env for the step:
//   OP=expect-item  NAME=<item name>   FIELDS="status=ordered,delivered_at=notnull"
//   OP=expect-count TABLE=items|tasks|flat_notes NAME=<name or title> COUNT=<n>
//   OP=expect-task  NAME=<title>       FIELDS="nikita=done,daryna=todo"
//   OP=expect-note  NAME=<title>       FIELDS="body=..."
//   OP=expect-task-row NAME=<title>    FIELDS="due=notnull"   the task row itself (not its assignments)
//   OP=expect-photo-row NAME=<item name> COUNT=<n>   item_photos rows for the item
//   OP=get-id       NAME=<name> [TABLE=items|tasks]  -> output.id
//   OP=add-item     NAME=<item name>                  insert as Claude if missing
//   OP=set-item     NAME=<item name>   FIELDS="status=ordered"      (as Claude, like the other phone)
//   OP=set-assignment NAME=<title>     FIELDS="daryna=done"

var base = SB_URL;
var key = SB_KEY;

function token() {
  if (output.sbToken) return output.sbToken;
  var r = http.post(base + '/auth/v1/token?grant_type=password', {
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  });
  if (!r.ok) throw new Error('DB: sign in as Claude failed (' + r.status + ')');
  output.sbToken = json(r.body).access_token;
  return output.sbToken;
}

function headers(extra) {
  var h = { apikey: key, Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' };
  for (var k in extra || {}) h[k] = extra[k];
  return h;
}

function get(path) {
  var r = http.get(base + '/rest/v1/' + path, { headers: headers() });
  if (!r.ok) throw new Error('DB: GET ' + path.split('?')[0] + ' failed (' + r.status + ')');
  return json(r.body);
}

function patch(path, row) {
  var r = http.request(base + '/rest/v1/' + path, { method: 'PATCH', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error('DB: PATCH ' + path.split('?')[0] + ' failed (' + r.status + ')');
  return json(r.body);
}

function fields() {
  var out = {};
  var s = typeof FIELDS === 'undefined' ? '' : FIELDS;
  s.split(',').forEach(function (p) {
    if (!p) return;
    var i = p.indexOf('=');
    out[p.slice(0, i).trim()] = p.slice(i + 1);
  });
  return out;
}

function same(value, want) {
  if (want === 'null') return value === null || value === undefined;
  if (want === 'notnull') return value !== null && value !== undefined;
  return String(value) === want;
}

var COL = { items: 'name', tasks: 'title', flat_notes: 'title' };
function live(table, name) {
  return get(table + '?select=*&deleted_at=is.null&' + COL[table] + '=eq.' + encodeURIComponent(name));
}

// No sleep in Maestro's JS: poll by repeating the request until the deadline.
function poll(what, read, ok) {
  var end = Date.now() + 1000 * (typeof TIMEOUT === 'undefined' ? 15 : Number(TIMEOUT));
  var last;
  do {
    last = read();
    if (ok(last)) return last;
  } while (Date.now() < end);
  var seen = Array.isArray(last) ? last.length + ' row(s), first ' + JSON.stringify(last[0] || null) : JSON.stringify(last);
  throw new Error('DB: ' + what + '; last seen ' + seen.slice(0, 300));
}

function one(table, name) {
  var rows = live(table, name);
  if (rows.length !== 1) throw new Error('DB: expected one live ' + table + ' row "' + name + '", found ' + rows.length);
  return rows[0];
}

function assignments(title) {
  var task = one('tasks', title);
  var rows = get('task_assignments?select=person,status&task_id=eq.' + task.id);
  var out = {};
  rows.forEach(function (a) { out[a.person] = a.status; });
  return out;
}

var want = fields();
var keys = Object.keys(want);
if (NAME.indexOf('ZZ-e2e-') !== 0) throw new Error('DB: test rows must start with ZZ-e2e-');

if (OP === 'expect-item' || OP === 'expect-note' || OP === 'expect-task-row') {
  var table = OP === 'expect-item' ? 'items' : OP === 'expect-note' ? 'flat_notes' : 'tasks';
  poll(table + ' "' + NAME + '" with ' + FIELDS, function () { return live(table, NAME); }, function (rows) {
    return rows.length === 1 && keys.every(function (k) { return same(rows[0][k], want[k]); });
  });
} else if (OP === 'expect-count') {
  poll(COUNT + ' live ' + TABLE + ' row(s) "' + NAME + '"', function () { return live(TABLE, NAME); }, function (rows) {
    return rows.length === Number(COUNT);
  });
} else if (OP === 'expect-task') {
  poll('task "' + NAME + '" with ' + FIELDS, function () { return assignments(NAME); }, function (got) {
    return Object.keys(got).length === keys.length && keys.every(function (p) { return got[p] === want[p]; });
  });
} else if (OP === 'expect-photo-row') {
  poll('item "' + NAME + '" with ' + COUNT + ' photo row(s)', function () {
    return get('item_photos?select=id,path&item_id=eq.' + one('items', NAME).id);
  }, function (rows) {
    return rows.length === Number(COUNT) && rows.every(function (r) { return r.path.indexOf('items/') === 0; });
  });
} else if (OP === 'get-id') {
  // Saves the id of the live item or task named NAME as output.id (TABLE defaults to items).
  output.id = one(typeof TABLE === 'undefined' ? 'items' : TABLE, NAME).id;
} else if (OP === 'add-item') {
  // Inserts a live item as Claude (like the other phone) unless one with this name already exists.
  if (live('items', NAME).length === 0) {
    var r = http.post(base + '/rest/v1/items', { headers: headers(), body: JSON.stringify({ name: NAME }) });
    if (!r.ok) throw new Error('DB: insert item failed (' + r.status + ')');
  }
} else if (OP === 'set-item') {
  patch('items?id=eq.' + one('items', NAME).id, want);
} else if (OP === 'set-assignment') {
  var id = one('tasks', NAME).id;
  keys.forEach(function (p) {
    if (patch('task_assignments?task_id=eq.' + id + '&person=eq.' + p, { status: want[p] }).length !== 1) throw new Error('DB: no ' + p + ' part on "' + NAME + '"');
  });
} else {
  throw new Error('DB: unknown OP ' + OP);
}

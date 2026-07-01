<?php
/**
 * Hypersheet Standalone PHP Demo
 * Run: php -S localhost:8000 backend.php
 *
 * Self-contained demo — no Composer required.
 * Uses file-based JSON storage. All features: inline edit, chips, dropdowns,
 * checklists, sorting, row reorder, and simulated Casbin auth.
 */

// ---- Minimal PSR-4 Autoloader for Hypersheet ----
spl_autoload_register(function ($class) {
    $prefix = 'Hypersheet\\';
    $base = __DIR__ . '/../backends/php/src/';
    if (strncmp($prefix, $class, strlen($prefix)) === 0) {
        $relative = substr($class, strlen($prefix));
        $file = $base . str_replace('\\', '/', $relative) . '.php';
        if (file_exists($file)) require $file;
    }
});

use Hypersheet\Grid;
use Hypersheet\Database\DatabaseFactory;

// ---- Configuration ----
$dataFile = __DIR__ . '/data/Hypersheet_demo.json';
$modelConf = __DIR__ . '/data/casbin_model.conf';
$policyCsv = __DIR__ . '/data/casbin_policy.csv';

// Ensure data directory exists
if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0755, true);
}

// Create default Casbin config if missing
if (!file_exists($modelConf)) {
    file_put_contents($modelConf, <<<MODEL
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
MODEL
    );
}

if (!file_exists($policyCsv)) {
    file_put_contents($policyCsv, <<<CSV
p, alice, column:name, read
p, alice, column:name, write
p, alice, column:email, read
p, alice, column:email, write
p, alice, column:status, read
p, alice, column:status, write
p, alice, column:tier, read
p, alice, column:tier, write
p, alice, column:tasks, read
p, alice, column:tasks, write
p, bob, column:name, read
p, bob, column:status, read
p, bob, column:status, write
p, bob, column:tier, read
p, bob, column:tier, write
p, bob, column:tasks, read
p, charlie, column:name, read
p, charlie, column:name, write
p, charlie, column:email, read
p, charlie, column:email, write
p, charlie, column:status, read
p, charlie, column:status, write
p, charlie, column:tier, read
p, charlie, column:tasks, read
p, charlie, column:tasks, write
CSV
    );
}

// Initialize JSON database with sample data
if (!file_exists($dataFile)) {
    $sampleData = [
        'users' => [
            ['id' => '1', 'name' => 'Alice Johnson', 'email' => 'alice@example.com', 'status' => 'Active', 'tier' => 'Enterprise', 'tasks' => 'Setup CI/CD,Write docs'],
            ['id' => '2', 'name' => 'Bob Smith', 'email' => 'bob@example.com', 'status' => 'Paused', 'tier' => 'Premium', 'tasks' => 'Review PR'],
            ['id' => '3', 'name' => 'Carol Davis', 'email' => 'carol@example.com', 'status' => 'Active', 'tier' => 'Free', 'tasks' => 'Fix bug #42,Deploy v2'],
            ['id' => '4', 'name' => 'Dave Wilson', 'email' => 'dave@example.com', 'status' => 'Archived', 'tier' => 'Enterprise', 'tasks' => 'Audit logs'],
            ['id' => '5', 'name' => 'Eve Martin', 'email' => 'eve@example.com', 'status' => 'Active', 'tier' => 'Premium', 'tasks' => 'Update deps,Write tests'],
        ],
        'logs' => [],
    ];
    file_put_contents($dataFile, json_encode($sampleData, JSON_PRETTY_PRINT));
}

// ---- Simple Casbin Simulator (no dependency required) ----
// When the real casbin/casbin library is installed, it will be used instead.
if (!class_exists('\Casbin\Enforcer', true)) {
    // Define a minimal Casbin-compatible class for the demo
    eval('
    namespace Casbin {
        class Enforcer {
            private $model, $policy;
            public function __construct($model, $policy) {
                $this->policy = array_map("str_getcsv", file($policy, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
            }
            public function enforce($sub, $obj, $act) {
                foreach ($this->policy as $line) {
                    if (count($line) >= 4 && $line[0] === "p" && $line[1] === $sub && $line[2] === $obj && $line[3] === $act) {
                        return true;
                    }
                }
                return false;
            }
        }
    }');
}

// ---- Routing ----
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$query = $_GET;
$userId = $query['user'] ?? 'alice';

// ---- API Endpoints ----
if (in_array($method, ['PUT', 'POST']) && $path === '/api/grid/cell') {
    header('Content-Type: application/json');

    // htmx sends form-encoded by default; extract values from POST
    $rowId = $_POST['row_id'] ?? '';
    // The column name is any POST key that isn't row_id
    $colName = '';
    $value = '';
    foreach ($_POST as $key => $val) {
        if ($key !== 'row_id') {
            $colName = $key;
            $value = $val;
            break;
        }
    }

    if ($rowId && $colName) {
        $data = json_decode(file_get_contents($dataFile), true);
        foreach ($data['users'] as &$row) {
            if ($row['id'] == $rowId) {
                $row[$colName] = $value;
                break;
            }
        }
        file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT));
    }

    echo json_encode(['status' => 'ok', 'row_id' => $rowId, 'field' => $colName, 'value' => $value]);
    exit;
}

if ($method === 'POST' && $path === '/api/grid/reorder') {
    header('Content-Type: application/json');

    // SortableJS + htmx sends row IDs as hx-vals or form data
    $order = [];
    if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
        $input = json_decode(file_get_contents('php://input'), true);
        $order = $input['order'] ?? [];
    } else {
        $order = $_POST['order'] ?? [];
    }

    if (!empty($order)) {
        $data = json_decode(file_get_contents($dataFile), true);
        $indexed = [];
        foreach ($data['users'] as $row) { $indexed[$row['id']] = $row; }
        $reordered = [];
        foreach ($order as $id) {
            if (isset($indexed[$id])) { $reordered[] = $indexed[$id]; }
        }
        foreach ($data['users'] as $row) {
            if (!in_array($row['id'], $order)) { $reordered[] = $row; }
        }
        $data['users'] = $reordered;
        file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT));
    }

    echo json_encode(['status' => 'ok']);
    exit;
}

if ($path === '/api/grid/rows') {
    header('Content-Type: application/json');
    $data = json_decode(file_get_contents($dataFile), true);
    echo json_encode($data['users']);
    exit;
}

// ---- Render Page ----
$columns = [
    ['name' => 'name', 'label' => 'Name', 'type' => 'text'],
    ['name' => 'email', 'label' => 'Email', 'type' => 'text'],
    ['name' => 'status', 'label' => 'Status', 'type' => 'chip'],
    ['name' => 'tier', 'label' => 'Tier', 'type' => 'dropdown', 'options' => ['Free', 'Premium', 'Enterprise']],
    ['name' => 'tasks', 'label' => 'Tasks', 'type' => 'text'],
];

$data = json_decode(file_get_contents($dataFile), true);
$rows = $data['users'];

// Build the grid
$grid = new Grid($columns, $rows);
$grid->withAuthorization(new \Casbin\Enforcer($modelConf, $policyCsv), $userId);

// Optional: enable logging
$logger = new \Hypersheet\CasbinLogger(['enabled' => true, 'log_file' => __DIR__ . '/data/casbin.log']);
$grid->withLogger($logger);

$gridHtml = $grid->render();

$userDisplay = [
    'alice' => ['label' => 'Alice', 'desc' => 'Full access'],
    'bob' => ['label' => 'Bob', 'desc' => 'No name/email write, no email read'],
    'charlie' => ['label' => 'Charlie', 'desc' => 'No tier/status write'],
];
$currentUser = $userDisplay[$userId] ?? $userDisplay['alice'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hypersheet — PHP Demo</title>
    <script src="https://unpkg.com/alpinejs@3/dist/cdn.min.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
<script defer src="/src/js/hypersheet.js"></script>
  <link rel="stylesheet" href="/src/css/hypersheet.css">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f3f4f6; color: #1f2937; padding: 2rem; }
        .container { max-width: 1100px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
        .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
        .user-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .user-bar a { padding: 0.375rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; text-decoration: none; color: #374151; font-size: 0.875rem; transition: all 0.15s; }
        .user-bar a:hover { background: #f9fafb; }
        .user-bar a.active { background: #3b82f6; color: white; border-color: #3b82f6; }
        .user-desc { font-size: 0.75rem; color: #9ca3af; margin-left: 0.5rem; }
        .grid-container { background: white; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
        .footer { margin-top: 1rem; font-size: 0.75rem; color: #9ca3af; display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .footer kbd { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 0.25rem; padding: 0.125rem 0.375rem; font-size: 0.6875rem; font-family: inherit; }
        .toast { position: fixed; bottom: 2rem; right: 2rem; padding: 0.75rem 1.25rem; border-radius: 0.5rem; background: #1f2937; color: white; font-size: 0.875rem; opacity: 0; transform: translateY(1rem); transition: all 0.3s; z-index: 50; }
        .toast.show { opacity: 1; transform: translateY(0); }
        .status-dot { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 50%; margin-right: 0.25rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ Hypersheet — PHP Demo</h1>
        <p class="subtitle">Live server-rendered grid with JSON file storage. htmx saves cells on blur.</p>

        <div class="user-bar">
            <span style="font-size:0.875rem;font-weight:500;">User:</span>
            <?php foreach ($userDisplay as $key => $info): ?>
                <a href="?user=<?= $key ?>" class="<?= $userId === $key ? 'active' : '' ?>">
                    <?= $info['label'] ?>
                </a>
            <?php endforeach; ?>
            <span class="user-desc"><?= $currentUser['desc'] ?></span>
        </div>

        <div class="grid-container" id="grid-container">
            <?= $gridHtml ?>
        </div>

        <div class="footer">
            <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Edit</span>
            <span><kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> Next/Prev</span>
            <span><kbd>Esc</kbd> Cancel</span>
            <span>⋮⋮ Drag to reorder</span>
            <span>↕ Click header to sort</span>
            <span id="cell-status"></span>
        </div>
    </div>

    <div class="toast" id="toast"></div>

    <script>
    // Notify on cell changes
    document.addEventListener('change', function(e) {
        if (e.target.matches('.hg-cell-input')) {
            const cell = e.target.closest('[data-row]');
            if (!cell) return;
            const row = cell.closest('tr');
            const rowId = row?.dataset?.id;
            const col = e.target.getAttribute('name');
            const val = e.target.value;
            document.getElementById('cell-status').textContent = `📝 ${col}: "${val}"`;
        }
    });

    // Toast helper
    function showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }

    // Listen for htmx events
    document.body.addEventListener('htmx:afterRequest', function(e) {
        if (e.detail.pathInfo.requestPath === '/api/grid/cell') {
            showToast('Cell saved');
        }
        if (e.detail.pathInfo.requestPath === '/api/grid/reorder') {
            showToast('Rows reordered');
        }
    });

    // Keyboard help overlay
    document.addEventListener('keydown', function(e) {
        if (e.key === '?' && !e.target.matches('input, textarea')) {
            showToast('Arrow: navigate | Enter: edit | Tab: next | Esc: cancel');
        }
    });
    </script>
</body>
</html>

<?php
/**
 * HyperGrid PHP Example
 * Run: php -S localhost:8000 index.php
 */

require_once __DIR__ . '/../../backends/php/vendor/autoload.php';

use HyperGrid\Grid;
use Casbin\Enforcer;

// --- Initialize Casbin ---
$modelConf = __DIR__ . '/casbin_model.conf';
$policyCsv = __DIR__ . '/casbin_policy.csv';

// Create default Casbin config files if they don't exist
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
p, alice, column:status, read
p, alice, column:status, write
p, alice, column:tier, read
p, bob, column:name, read
p, bob, column:status, read
p, bob, column:tier, read
p, bob, column:tier, write
CSV
    );
}

$enforcer = new Enforcer($modelConf, $policyCsv);

// --- Sample Data ---
$columns = [
    ['name' => 'name', 'label' => 'User Profile', 'type' => 'text'],
    ['name' => 'status', 'label' => 'Lifecycle State', 'type' => 'chip'],
    ['name' => 'tier', 'label' => 'Assigned Subscription', 'type' => 'dropdown', 'options' => ['Free', 'Premium', 'Enterprise']],
];

$rows = [
    ['id' => '1', 'name' => 'Alice Johnson', 'status' => 'Active', 'tier' => 'Enterprise'],
    ['id' => '2', 'name' => 'Bob Smith', 'status' => 'Paused', 'tier' => 'Free'],
    ['id' => '3', 'name' => 'Carol Davis', 'status' => 'Archived', 'tier' => 'Premium'],
    ['id' => '4', 'name' => 'Dave Wilson', 'status' => 'Active', 'tier' => 'Premium'],
];

// --- Determine user (simulate auth) ---
$userId = $_GET['user'] ?? 'alice';

// --- Render Grid ---
$grid = new Grid($enforcer, $userId, $columns, $rows);

// --- Handle htmx endpoints ---
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($method === 'PUT' && $path === '/api/grid/cell') {
    header('Content-Type: application/json');
    $input = json_decode(file_get_contents('php://input'), true);
    // In production, update database here
    echo json_encode(['status' => 'ok', 'updated' => $input]);
    exit;
}

if ($method === 'POST' && $path === '/api/grid/reorder') {
    header('Content-Type: application/json');
    $input = json_decode(file_get_contents('php://input'), true);
    // In production, reorder database rows here
    echo json_encode(['status' => 'ok', 'reorder' => $input]);
    exit;
}

// --- Render Page ---
$gridHtml = $grid->render();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HyperGrid PHP Example</title>
    <script src="https://unpkg.com/alpinejs@3/dist/cdn.min.js" defer></script>
    <script src="https://unpkg.com/hypergrid@0.1/dist/hypergrid.js" defer></script>
    <link rel="stylesheet" href="https://unpkg.com/hypergrid@0.1/dist/hypergrid.css">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .user-switch { margin-bottom: 1.5rem; display: flex; gap: 0.5rem; align-items: center; }
        .user-switch a { padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; text-decoration: none; color: #374151; }
        .user-switch a.active { background: #3b82f6; color: white; border-color: #3b82f6; }
    </style>
</head>
<body>
    <h1>HyperGrid — PHP Example</h1>
    <div class="user-switch">
        <span>User:</span>
        <a href="?user=alice" class="<?= $userId === 'alice' ? 'active' : '' ?>">Alice</a>
        <a href="?user=bob" class="<?= $userId === 'bob' ? 'active' : '' ?>">Bob</a>
        <span style="color: #6b7280; font-size: 0.875rem; margin-left: 1rem;">
            (Bob has restricted column write access)
        </span>
    </div>
    <?= $gridHtml ?>
    <p style="margin-top: 1rem; font-size: 0.75rem; color: #9ca3af;">
        Use arrow keys to navigate, Enter to edit, Escape to cancel, Tab to move between cells.
        Drag ⋮⋮ to reorder rows. Click column headers to sort.
    </p>
</body>
</html>

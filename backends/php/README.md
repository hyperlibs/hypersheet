# Hypersheet PHP Backend

Library for server-side rendering of Hypersheet tables. Casbin authorization is optional.

## Install

```bash
composer require Hypersheet/grid
```

## Quick Start

```php
use Hypersheet\Grid;

$grid = new Grid(
    columns: [
        ['name' => 'name', 'label' => 'Name', 'type' => 'text'],
        ['name' => 'status', 'label' => 'Status', 'type' => 'chip'],
    ],
    rows: [
        ['id' => '1', 'name' => 'Alice', 'status' => 'Active'],
    ]
);

echo $grid->render();
```

## With Casbin Authorization

```php
$enforcer = new Enforcer('model.conf', 'policy.csv');
$grid->withAuth($enforcer, 'alice');

// Optional: audit logging
$logger = new CasbinLogger(['enabled' => true, 'log_file' => '/tmp/casbin.log']);
$grid->withLogger($logger);

echo $grid->render();
```

## With Database

```php
use Hypersheet\Database\dbFactory;

$db = dbFactory::create('pgsql');
$db->connect(['host' => 'localhost', 'database' => 'Hypersheet', 'username' => 'postgres']);

$rows = $db->fetchRows('users', ['name', 'status', 'tier']);
$grid = new Grid($columns, $rows);
```

## Cell Types

`text`, `chip`, `dropdown`, `checkbox`, `checklist`

## API

- `Grid::render()` — full wrapped table
- `Grid::renderBodyFragment()` — `<tbody>` only (htmx partial)
- `Grid::renderHeaderFragment()` — `<thead>` only

# HyperGrid PHP Backend

Library for server-side rendering of HyperGrid tables. Casbin authorization is optional.

## Install

```bash
composer require hypergrid/grid
```

## Quick Start

```php
use HyperGrid\Grid;

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
$grid->withAuthorization($enforcer, 'alice');

// Optional: audit logging
$logger = new CasbinLogger(['enabled' => true, 'log_file' => '/tmp/casbin.log']);
$grid->withLogger($logger);

echo $grid->render();
```

## With Database

```php
use HyperGrid\Database\DatabaseFactory;

$db = DatabaseFactory::create('pgsql');
$db->connect(['host' => 'localhost', 'database' => 'hypergrid', 'username' => 'postgres']);

$rows = $db->fetchRows('users', ['name', 'status', 'tier']);
$grid = new Grid($columns, $rows);
```

## Cell Types

`text`, `chip`, `dropdown`, `checkbox`, `checklist`

## API

- `Grid::render()` — full wrapped table
- `Grid::renderBodyFragment()` — `<tbody>` only (htmx partial)
- `Grid::renderHeaderFragment()` — `<thead>` only

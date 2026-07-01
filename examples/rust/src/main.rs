// Hypersheet Rust Example
// Run: cargo run
// Requires: axum, tokio, tower-http (serve static)

use axum::{
    extract::Query,
    http::StatusCode,
    response::{Html, Json},
    routing::{get, put},
    Router,
};
use casbin::prelude::*;
use hypersheet::{CellType, ChecklistItem, Column, Grid, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Deserialize)]
struct PageQuery {
    user: Option<String>,
}

#[derive(Serialize)]
struct ApiResponse {
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reorder: Option<serde_json::Value>,
}

#[tokio::main]
async fn main() {
    // Initialize Casbin
    let model = r#"
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
"#;
    let policy = r#"
p, alice, column:name, read
p, alice, column:name, write
p, alice, column:status, read
p, alice, column:status, write
p, alice, column:tier, read
p, bob, column:name, read
p, bob, column:status, read
p, bob, column:tier, read
p, bob, column:tier, write
"#;

    std::fs::write("casbin_model.conf", model).ok();
    std::fs::write("casbin_policy.csv", policy).ok();

    let enforcer = casbin::Enforcer::new("casbin_model.conf", "casbin_policy.csv")
        .await
        .expect("Casbin init failed");

    let enforcer = Arc::new(RwLock::new(enforcer));

    let columns = vec![
        Column {
            name: "name".into(),
            label: "User Profile".into(),
            cell_type: CellType::Text,
        },
        Column {
            name: "status".into(),
            label: "Lifecycle State".into(),
            cell_type: CellType::Chip,
        },
        Column {
            name: "tier".into(),
            label: "Assigned Subscription".into(),
            cell_type: CellType::Dropdown(vec![
                "Free".into(),
                "Premium".into(),
                "Enterprise".into(),
            ]),
        },
    ];

    let rows = vec![
        row("1", "Alice Johnson", "Active", "Enterprise"),
        row("2", "Bob Smith", "Paused", "Free"),
        row("3", "Carol Davis", "Archived", "Premium"),
        row("4", "Dave Wilson", "Active", "Premium"),
    ];

    let app = Router::new()
        .route("/", get(move |query: Option<Query<PageQuery>>| {
            let enforcer = enforcer.clone();
            let columns = columns.clone();
            let rows = rows.clone();
            async move {
                let user_id = query
                    .and_then(|q| q.user.clone())
                    .unwrap_or_else(|| "alice".into());

                let enf = enforcer.read().await;
                let grid = Grid::new(Some(enf.clone()), &user_id, columns, rows);
                let grid_html = grid.render();

                let html = format!(
                    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hypersheet Rust Example</title>
    <script src="https://unpkg.com/alpinejs@3/dist/cdn.min.js" defer></script>
    <script src="https://unpkg.com/hypersheet@0.1/dist/hypersheet.js" defer></script>
    <link rel="stylesheet" href="https://unpkg.com/hypersheet@0.1/dist/hypersheet.css">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
        .user-switch {{ margin-bottom: 1.5rem; display: flex; gap: 0.5rem; align-items: center; }}
        .user-switch a {{ padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; text-decoration: none; color: #374151; }}
        .user-switch a.active {{ background: #3b82f6; color: white; border-color: #3b82f6; }}
    </style>
</head>
<body>
    <h1>Hypersheet — Rust Example</h1>
    <div class="user-switch">
        <span>User:</span>
        <a href="/?user=alice" class="{}">Alice</a>
        <a href="/?user=bob" class="{}">Bob</a>
        <span style="color: #6b7280; font-size: 0.875rem; margin-left: 1rem;">
            (Bob has restricted column write access)
        </span>
    </div>
    {}
    <p style="margin-top: 1rem; font-size: 0.75rem; color: #9ca3af;">
        Use arrow keys to navigate, Enter to edit, Escape to cancel, Tab to move between cells.
        Drag ⋮⋮ to reorder rows. Click column headers to sort.
    </p>
</body>
</html>"#,
                    if user_id == "alice" { "active" } else { "" },
                    if user_id == "bob" { "active" } else { "" },
                    grid_html
                );

                Html(html)
            }
        }))
        .route("/api/grid/cell", put(|| async {
            Json(ApiResponse {
                status: "ok".into(),
                updated: None,
                reorder: None,
            })
        }))
        .route("/api/grid/reorder", put(|| async {
            Json(ApiResponse {
                status: "ok".into(),
                updated: None,
                reorder: None,
            })
        }));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000").await.unwrap();
    println!("Hypersheet Rust example running at http://localhost:8000");
    axum::serve(listener, app).await.unwrap();
}

fn row(id: &str, name: &str, status: &str, tier: &str) -> Row {
    let mut map = HashMap::new();
    map.insert("id".into(), id.into());
    map.insert("name".into(), name.into());
    map.insert("status".into(), status.into());
    map.insert("tier".into(), tier.into());
    map
}

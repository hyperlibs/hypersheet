# Hypersheet Demos

## Static Demo (No Backend Required)

Open `demo/index.html` directly in your browser. Demonstrates all cell types, keyboard navigation, sorting, drag-reorder, and simulated auth — no server needed.

```bash
# Or serve it:
npx serve demo/
```

## PHP Backend Demo (Full CRUD)

Self-contained demo with Casbin auth, JSON file storage, and htmx persistence.

```bash
# From project root:
php -S localhost:8000 demo/backend.php

# Then open http://localhost:8000
```

Switching users via `?user=bob` or `?user=charlie` simulates different Casbin access policies.

### Policies

| User | Name | Email | Status | Tier |
|------|------|-------|--------|------|
| alice | r/w | r/w | r/w | r/w |
| bob | r/o | r/o | r/w | r/w |
| charlie | r/w | r/w | r/o | r/o |

## Python Backend Demo

```bash
cd examples/python
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Go Backend Demo

```bash
cd examples/go
go run main.go
```

## Rust Backend Demo

```bash
cd examples/rust
cargo run
```

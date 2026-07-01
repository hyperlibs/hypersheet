package main

import (
	"embed"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/casbin/casbin/v2"
	hypersheet "github.com/hyperlibs/hypersheet/src"
)

//go:embed templates/*
var templateFS embed.FS

var enforcer *casbin.SyncedEnforcer

func initCasbin() {
	// Create model and policy if not exists
	os.WriteFile("casbin_model.conf", []byte(`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && regexMatch(r.act, p.act)
`), 0644)
	os.WriteFile("casbin_policy.csv", []byte(`
p, alice, column:name, read
p, alice, column:name, write
p, alice, column:status, read
p, alice, column:status, write
p, alice, column:tier, read
p, bob, column:name, read
p, bob, column:status, read
p, bob, column:tier, read
p, bob, column:tier, write
`), 0644)

	var err error
	enforcer, err = casbin.NewSyncedEnforcer("casbin_model.conf", "casbin_policy.csv")
	if err != nil {
		log.Fatal("Casbin init failed:", err)
	}
}

func main() {
	initCasbin()

	columns := []hypersheet.Column{
		{Name: "name", Label: "User Profile", Type: "text"},
		{Name: "status", Label: "Lifecycle State", Type: "chip"},
		{Name: "tier", Label: "Assigned Subscription", Type: "dropdown", Options: []string{"Free", "Premium", "Enterprise"}},
	}

	rows := []hypersheet.Row{
		{"id": "1", "name": "Alice Johnson", "status": "Active", "tier": "Enterprise"},
		{"id": "2", "name": "Bob Smith", "status": "Paused", "tier": "Free"},
		{"id": "3", "name": "Carol Davis", "status": "Archived", "tier": "Premium"},
		{"id": "4", "name": "Dave Wilson", "status": "Active", "tier": "Premium"},
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user")
		if userID == "" {
			userID = "alice"
		}

		grid := hypersheet.NewGrid(enforcer, userID, columns, rows)
		gridHTML := grid.Render()

		tmpl := template.Must(template.ParseFS(templateFS, "templates/page.html"))
		tmpl.Execute(w, map[string]interface{}{
			"GridHTML": template.HTML(gridHTML),
			"UserID":   userID,
		})
	})

	mux.HandleFunc("/api/grid/cell", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "Method not allowed", 405)
			return
		}
		var data map[string]interface{}
		json.NewDecoder(r.Body).Decode(&data)
		// In production, update database here
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "updated": data})
	})

	mux.HandleFunc("/api/grid/reorder", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		var data map[string]interface{}
		json.NewDecoder(r.Body).Decode(&data)
		// In production, reorder database here
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "reorder": data})
	})

	log.Println("hypersheet Go example running at http://localhost:8000")
	log.Fatal(http.ListenAndServe(":8000", mux))
}

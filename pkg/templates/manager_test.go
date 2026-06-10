package templates

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gorilla/mux"
)

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	return NewManager(t.TempDir())
}

func templateNames(templates []Template) map[string]bool {
	names := make(map[string]bool, len(templates))
	for _, template := range templates {
		names[template.Name] = true
	}
	return names
}

func TestHandleDeleteSupportsQueryName(t *testing.T) {
	manager := newTestManager(t)
	if err := manager.save([]Template{
		{Name: "GPU preset", Params: map[string]interface{}{"ngl": 99}},
		{Name: "Keep", Params: map[string]interface{}{"ngl": 1}},
	}); err != nil {
		t.Fatalf("save templates: %v", err)
	}

	request := httptest.NewRequest(http.MethodDelete, "/api/templates?name="+url.QueryEscape("GPU preset"), nil)
	response := httptest.NewRecorder()
	manager.HandleDelete().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%q", response.Code, http.StatusOK, response.Body.String())
	}
	templates, err := manager.load()
	if err != nil {
		t.Fatalf("load templates: %v", err)
	}
	names := templateNames(templates)
	if names["GPU preset"] {
		t.Fatal("query delete left removed template in storage")
	}
	if !names["Keep"] {
		t.Fatal("query delete removed the wrong template")
	}
}

func TestHandleDeleteSupportsPathName(t *testing.T) {
	manager := newTestManager(t)
	if err := manager.save([]Template{
		{Name: "Path preset", Params: map[string]interface{}{"threads": 4}},
		{Name: "Keep", Params: map[string]interface{}{"threads": 1}},
	}); err != nil {
		t.Fatalf("save templates: %v", err)
	}

	router := mux.NewRouter()
	router.HandleFunc("/api/templates/{name}", manager.HandleDelete()).Methods(http.MethodDelete)

	request := httptest.NewRequest(http.MethodDelete, "/api/templates/"+url.PathEscape("Path preset"), nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body=%q", response.Code, http.StatusOK, response.Body.String())
	}
	templates, err := manager.load()
	if err != nil {
		t.Fatalf("load templates: %v", err)
	}
	names := templateNames(templates)
	if names["Path preset"] {
		t.Fatal("path delete left removed template in storage")
	}
	if !names["Keep"] {
		t.Fatal("path delete removed the wrong template")
	}
}

func TestHandleDeleteRequiresName(t *testing.T) {
	manager := newTestManager(t)

	request := httptest.NewRequest(http.MethodDelete, "/api/templates", nil)
	response := httptest.NewRecorder()
	manager.HandleDelete().ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
}

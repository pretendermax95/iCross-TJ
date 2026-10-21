package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type Product struct {
	ID       int      `json:"id"`
	Name     string   `json:"name"`
	Brand    string   `json:"brand"`
	Category string   `json:"category"`
	Price    int      `json:"price"`
	OldPrice int      `json:"oldPrice,omitempty"`
	Image    string   `json:"image"`
	Tag      string   `json:"tag,omitempty"`
	Colors   []string `json:"colors"`
	Sizes    []int    `json:"sizes"`
}

type OrderItem struct {
	ProductID int `json:"productId"`
	Size      int `json:"size"`
	Quantity  int `json:"quantity"`
}

type OrderRequest struct {
	Name    string      `json:"name"`
	Phone   string      `json:"phone"`
	Email   string      `json:"email"`
	Address string      `json:"address"`
	Comment string      `json:"comment"`
	Items   []OrderItem `json:"items"`
}

type OrderResponse struct {
	OrderID string `json:"orderId"`
	Total   int    `json:"total"`
	Message string `json:"message"`
}

var products = []Product{
	{1, "Air Max Pulse", "Nike", "running", 1290, 1490, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", "ХИТ", []string{"#f5533d", "#171717"}, []int{39, 40, 41, 42, 43, 44}},
	{2, "Campus 00s", "Adidas", "lifestyle", 990, 1190, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85", "−17%", []string{"#e8c99b", "#343434"}, []int{38, 39, 40, 41, 42, 43}},
	{3, "574 Core", "New Balance", "lifestyle", 1150, 0, "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=900&q=85", "НОВИНКА", []string{"#8a9aaa", "#7f9875"}, []int{39, 40, 41, 42, 43, 44, 45}},
	{4, "Dunk Low Retro", "Nike", "lifestyle", 1390, 1590, "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85", "", []string{"#e8e3d7", "#496288"}, []int{38, 39, 40, 41, 42, 43}},
	{5, "Ultraboost Light", "Adidas", "running", 1690, 0, "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?auto=format&fit=crop&w=900&q=85", "ПРЕМИУМ", []string{"#292929", "#e6e6e6"}, []int{40, 41, 42, 43, 44, 45}},
	{6, "574 Legacy", "New Balance", "lifestyle", 1250, 0, "https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=900&q=85", "", []string{"#d1b59b", "#707d87"}, []int{39, 40, 41, 42, 43}},
	{7, "Air Force 1 '07", "Nike", "lifestyle", 1450, 1650, "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=85", "−12%", []string{"#f2f0ea", "#222222"}, []int{38, 39, 40, 41, 42, 43, 44}},
	{8, "Forum Low", "Adidas", "lifestyle", 1090, 0, "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=85", "", []string{"#e5e1d6", "#a45f47"}, []int{39, 40, 41, 42, 43, 44}},
}

var (
	orderMu sync.Mutex
	orders  []OrderRequest
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/products", productsHandler)
	mux.HandleFunc("/api/orders", ordersHandler)
	mux.Handle("/", http.FileServer(http.Dir("web")))

	addr := os.Getenv("ADDR")
	if addr == "" {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		addr = ":" + port
	}
	server := &http.Server{
		Addr:              addr,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("iCross TJ запущен: http://localhost%s", addr)
	log.Fatal(server.ListenAndServe())
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func ordersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var order OrderRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&order); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте данные заказа")
		return
	}
	if err := validateOrder(order); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	total := 0
	for _, item := range order.Items {
		product, _ := findProduct(item.ProductID)
		total += product.Price * item.Quantity
	}

	orderMu.Lock()
	orders = append(orders, order)
	orderNumber := len(orders)
	orderMu.Unlock()

	writeJSON(w, http.StatusCreated, OrderResponse{
		OrderID: fmt.Sprintf("IC-%d-%04d", time.Now().Year(), orderNumber),
		Total:   total,
		Message: "Заказ принят! Мы скоро свяжемся с вами.",
	})
}

func validateOrder(order OrderRequest) error {
	if strings.TrimSpace(order.Name) == "" {
		return errors.New("Укажите ваше имя")
	}
	if strings.TrimSpace(order.Phone) == "" {
		return errors.New("Укажите номер телефона")
	}
	if strings.TrimSpace(order.Address) == "" {
		return errors.New("Укажите адрес доставки")
	}
	if len(order.Items) == 0 {
		return errors.New("Корзина пуста")
	}
	for _, item := range order.Items {
		product, ok := findProduct(item.ProductID)
		if !ok || item.Quantity < 1 || item.Quantity > 20 {
			return errors.New("В заказе есть некорректный товар")
		}
		sizeAvailable := false
		for _, size := range product.Sizes {
			if size == item.Size {
				sizeAvailable = true
				break
			}
		}
		if !sizeAvailable {
			return errors.New("Выберите доступный размер")
		}
	}
	return nil
}

func findProduct(id int) (Product, bool) {
	for _, product := range products {
		if product.ID == id {
			return product, true
		}
	}
	return Product{}, false
}

func methodNotAllowed(w http.ResponseWriter, allowed string) {
	w.Header().Set("Allow", allowed)
	writeError(w, http.StatusMethodNotAllowed, "Метод не поддерживается")
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("ошибка отправки JSON: %v", err)
	}
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

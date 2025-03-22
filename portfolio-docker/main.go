package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	_ "github.com/mattn/go-sqlite3"
	db "github.com/meduaq/portfolio-backend/db/sqlc"
)

// Response structure for API responses
type Response struct {
	Success bool          `json:"success"`
	Message string        `json:"message,omitempty"`
	Token   string        `json:"token,omitempty"`
	User    *UserResponse `json:"user,omitempty"`
	Data    interface{}   `json:"data,omitempty"`
}

// UserResponse is the user data sent in responses
type UserResponse struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// PhotoResponse represents a photo in the response
type PhotoResponse struct {
	ID         string `json:"id"`
	Filename   string `json:"filename"`
	Title      string `json:"title"`
	Category   string `json:"category"`
	URL        string `json:"url"`
	UploadDate string `json:"uploadDate"`
}

// Credentials for login/register
type Credentials struct {
	Name     string `json:"name,omitempty"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

var dbConn *sql.DB
var queries *db.Queries
var jwtKey = []byte(os.Getenv("JWT_SECRET_KEY")) // In production, use environment variables

func main() {
	// Initialize database connection
	initDB()

	// Create router
	r := mux.NewRouter()

	// Define API routes
	r.HandleFunc("/api/register", registerHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", loginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/profile", authMiddleware(profileHandler)).Methods("GET", "OPTIONS")

	// Photo management routes
	r.HandleFunc("/api/photos/upload", authMiddleware(uploadPhotoHandler)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/photos/{category}", getPhotosByCategoryHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/photos/{id}", authMiddleware(deletePhotoHandler)).Methods("DELETE", "OPTIONS")

	// Serve static files
	r.PathPrefix("/photos/").Handler(http.StripPrefix("/photos/", http.FileServer(http.Dir("photos"))))

	// CORS middleware
	r.Use(corsMiddleware)

	// Start server
	port := "8080"
	fmt.Printf("Server running on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func initDB() {
	var err error
	// Use environment variables for these credentials in production
      
	connStr := "database.db" // Path to your SQLite database file
	dbConn, err = sql.Open("sqlite3", connStr)
	if err != nil {
		log.Fatal(err)
	}

	// Test the connection
	err = dbConn.Ping()
	if err != nil {
		log.Fatal(err)
	}

	// Initialize the queries with our database connection
	queries = db.New(dbConn)

	// Execute schema migration
	
	_, err = dbConn.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Database initialized successfully")
	
	// Initialize photo directories
	initPhotoDirectories()
}

// Initialize the photos directory structure
func initPhotoDirectories() {
	baseDir := "photos"
	
	// Create base directory if it doesn't exist
	if _, err := os.Stat(baseDir); os.IsNotExist(err) {
		os.Mkdir(baseDir, 0755)
	}
	
	// Create category directories
	categories := []string{"featured", "digital-sketches", "notebook-sketches", "photography"}
	for _, category := range categories {
		categoryPath := filepath.Join(baseDir, category)
		if _, err := os.Stat(categoryPath); os.IsNotExist(err) {
			os.Mkdir(categoryPath, 0755)
		}
	}
	
	fmt.Println("Photo directories initialized successfully")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Validate input
	if creds.Name == "" || creds.Email == "" || creds.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Name, email, and password are required")
		return
	}

	ctx := context.Background()

	// Check if email already exists using sqlc
	emailExists, err := queries.CheckEmailExists(ctx, creds.Email)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if emailExists == 1 {
		respondWithError(w, http.StatusConflict, "Email already in use")
		return
	}
	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(creds.Password), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error hashing password")
		return
	}

	// Insert the new user using sqlc
	params := db.CreateUserParams{
		Name:     creds.Name,
		Email:    creds.Email,
		Password: string(hashedPassword),
	}

	_, err = queries.CreateUser(ctx, params)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error creating user")
		return
	}

	// Return success response
	respondWithJSON(w, http.StatusCreated, Response{
		Success: true,
		Message: "User registered successfully",
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Validate input
	if creds.Email == "" || creds.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	ctx := context.Background()

	// Get the user from the database using sqlc
	user, err := queries.GetUserByEmail(ctx, creds.Email)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	fmt.Println("Stored password hash:", user.Password)
	fmt.Println("Provided password:", creds.Password)
	// Compare the stored hashed password with the provided password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password))
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	// Convert GetUserByEmailRow to User for JWT generation
	userForJWT := db.User{
		ID:    int64(user.ID),
		Name:  user.Name,
		Email: user.Email,
	}

	// Create a JWT token
	token, err := generateJWT(userForJWT)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error generating token")
		return
	}

	// Return the token
	respondWithJSON(w, http.StatusOK, Response{
		Success: true,
		Token:   token,
		User: &UserResponse{
			ID:    int64(user.ID),
			Name:  user.Name,
			Email: user.Email,
		},
	})
}

func profileHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by authMiddleware)
	userID := r.Context().Value("userID").(int64)
	ctx := context.Background()

	// Get user from database using sqlc, cast userID to int64
	user, err := queries.GetUserByID(ctx, userID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Return user data, cast user.ID to int32
	respondWithJSON(w, http.StatusOK, Response{
		Success: true,
		User: &UserResponse{
			ID:    int64(user.ID), // Cast to int32
			Name:  user.Name,
			Email: user.Email,
		},
	})
}

// Generate a random ID for photos
func generateID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// Upload a photo
func uploadPhotoHandler(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}
	
	// Get form values
	title := r.FormValue("title")
	category := r.FormValue("category")
	
	// Validate category
	validCategories := map[string]bool{
		"featured": true,
		"digital-sketches": true,
		"notebook-sketches": true,
		"photography": true,
	}
	
	if !validCategories[category] {
		respondWithError(w, http.StatusBadRequest, "Invalid category")
		return
	}
	
	// Get file from form
	file, handler, err := r.FormFile("photo")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to get file from form")
		return
	}
	defer file.Close()
	
	// Check file type
	contentType := handler.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		respondWithError(w, http.StatusBadRequest, "File must be an image")
		return
	}
	
	// Generate unique filename
	fileExt := filepath.Ext(handler.Filename)
	photoID := generateID()
	filename := photoID + fileExt
	
	// Create destination file
	categoryDir := filepath.Join("photos", category)
	destPath := filepath.Join(categoryDir, filename)
	
	dest, err := os.Create(destPath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create destination file")
		return
	}
	defer dest.Close()
	
	// Copy file
	_, err = io.Copy(dest, file)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	
	// Get the server's hostname and port for the URL
	host := r.Host
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	
	photoURL := fmt.Sprintf("%s://%s/photos/%s/%s", scheme, host, category, filename)
	
	// Return success response
	respondWithJSON(w, http.StatusCreated, Response{
		Success: true,
		Message: "Photo uploaded successfully",
		Data: PhotoResponse{
			ID:         photoID,
			Filename:   filename,
			Title:      title,
			Category:   category,
			URL:        photoURL,
			UploadDate: time.Now().Format(time.RFC3339),
		},
	})
}

// Get photos by category
func getPhotosByCategoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	category := vars["category"]
	
	// Validate category
	validCategories := map[string]bool{
		"featured": true,
		"digital-sketches": true,
		"notebook-sketches": true,
		"photography": true,
	}
	
	if !validCategories[category] {
		respondWithError(w, http.StatusBadRequest, "Invalid category")
		return
	}
	
	// Get files from directory
	categoryDir := filepath.Join("photos", category)
	files, err := os.ReadDir(categoryDir)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read directory")
		return
	}
	
	// Get the server's hostname and port for the URL
	host := r.Host
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	
	// Create response
	photos := []PhotoResponse{}
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		
		// Get file info
		fileInfo, err := file.Info()
		if err != nil {
			continue
		}
		
		// Get file extension
		filename := file.Name()
		fileExt := filepath.Ext(filename)
		photoID := strings.TrimSuffix(filename, fileExt)
		
		// Create photo response
		photoURL := fmt.Sprintf("%s://%s/photos/%s/%s", scheme, host, category, filename)
		
		photos = append(photos, PhotoResponse{
			ID:         photoID,
			Filename:   filename,
			Title:      strings.TrimSuffix(filename, fileExt), // Use filename as title if no title in DB
			Category:   category,
			URL:        photoURL,
			UploadDate: fileInfo.ModTime().Format(time.RFC3339),
		})
	}
	
	// Return response
	respondWithJSON(w, http.StatusOK, Response{
		Success: true,
		Data:    photos,
	})
}

// Delete a photo

func deletePhotoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	photoID := vars["id"]
	
	// Find the photo in all categories
	categories := []string{"featured", "digital-sketches", "notebook-sketches", "photography"}
	var foundPath string
	
	for _, category := range categories {
		categoryDir := filepath.Join("photos", category)
		files, err := os.ReadDir(categoryDir)
		if err != nil {
			continue
		}
		
		for _, file := range files {
			if file.IsDir() {
				continue
			}
			
			filename := file.Name()
			fileExt := filepath.Ext(filename)
			id := strings.TrimSuffix(filename, fileExt)
			
			if id == photoID {
				foundPath = filepath.Join(categoryDir, filename)
				break
			}
		}
		
		if foundPath != "" {
			break
		}
	}
	
	// If photo not found
	if foundPath == "" {
		respondWithError(w, http.StatusNotFound, "Photo not found")
		return
	}
	
	// Delete the file
	err := os.Remove(foundPath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete photo")
		return
	}
	
	// Return success response
	respondWithJSON(w, http.StatusOK, Response{
		Success: true,
		Message: "Photo deleted successfully",
	})
}
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get the Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			respondWithError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}

		// Check if the header has the Bearer prefix
		if !strings.HasPrefix(authHeader, "Bearer ") {
			respondWithError(w, http.StatusUnauthorized, "Invalid authorization format")
			return
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtKey, nil
		})

		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		// Check if the token is valid
		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			// Check if the token is expired
			if exp, ok := claims["exp"].(float64); ok && float64(time.Now().Unix()) > exp {
				respondWithError(w, http.StatusUnauthorized, "Token expired")
				return
			}

			// Get the user ID from the token
			userID := int64(claims["user_id"].(float64))

			// Create a new request context with the user ID
			ctx := r.Context()
			ctx = context.WithValue(ctx, "userID", userID)

			// Call the next handler with the new context
			next(w, r.WithContext(ctx))
		} else {
			respondWithError(w, http.StatusUnauthorized, "Invalid token")
		}
	}
}

func generateJWT(user db.User) (string, error) {
	// Create the token
	token := jwt.New(jwt.SigningMethodHS256)

	// Set the claims
	claims := token.Claims.(jwt.MapClaims)
	claims["user_id"] = user.ID
	claims["email"] = user.Email
	claims["exp"] = time.Now().Add(time.Hour * 24).Unix() // Token expires in 24 hours

	// Sign the token with the secret key
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, Response{
		Success: false,
		Message: message,
	})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Error encoding response"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

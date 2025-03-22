FROM golang:1.24-alpine AS builder

# Install required dependencies
RUN apk add --no-cache git gcc musl-dev

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o portfolio-backend main.go

# Create the final image
FROM alpine:latest

# Install required runtime dependencies
RUN apk add --no-cache ca-certificates tzdata sqlite

# Set working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/portfolio-backend .

# Create necessary directories
RUN mkdir -p photos/featured photos/digital-sketches photos/notebook-sketches photos/photography

# Expose port
EXPOSE 8080

# Command to run
CMD ["./portfolio-backend"]

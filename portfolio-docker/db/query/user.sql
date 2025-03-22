
-- name: CreateUser :one
INSERT INTO users (
    name,
    email,
    password
) 
VALUES (
    ?, ?, ?
) 
RETURNING id, name, email, created_at;

-- name: GetUserByEmail :one
SELECT 
    id, 
    name, 
    email, 
    password 
FROM users
WHERE email = ? 
LIMIT 1;

-- name: GetUserByID :one
SELECT 
    id, 
    name, 
    email 
FROM users
WHERE id = ? 
LIMIT 1;

-- name: CheckEmailExists :one
SELECT 
    EXISTS(SELECT 1 FROM users WHERE email = ?);

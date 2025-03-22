import { jwtVerify } from "jose"

export async function verifyAuth(token: string | null): Promise<boolean> {
  if (!token) return false

  try {
    // This would normally use a proper secret key from environment variables
    const secret = new TextEncoder().encode("your-secret-key")
    await jwtVerify(token, secret)
    return true
  } catch (error) {
    return false
  }
}


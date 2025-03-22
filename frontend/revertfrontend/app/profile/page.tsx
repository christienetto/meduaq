
"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Upload } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface User {
  id: number
  name: string
  email: string
}

interface Photo {
  id: string
  filename: string
  title: string
  category: string
  url: string
  uploadDate: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedCategory, setSelectedCategory] = useState("featured")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [photoTitle, setPhotoTitle] = useState("")

  const categories = [
    { value: "featured", label: "Featured Works" },
    { value: "digital-sketches", label: "Digital Sketches" },
    { value: "notebook-sketches", label: "Notebook Sketches" },
    { value: "photography", label: "Photography" },
  ]

  useEffect(() => {
    const token = localStorage.getItem("token")

    if (!token) {
      router.push("/login")
      return
    }

    const fetchUserProfile = async () => {
      try {
        const response = await fetch("http://37.27.210.128:8080/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch profile")
        }

        const data = await response.json()
        setUser(data.user)
      } catch (error) {
        console.error("Error fetching profile:", error)
        localStorage.removeItem("token")
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
    fetchPhotos(selectedCategory)
  }, [router, selectedCategory])

  const fetchPhotos = async (category: string) => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const response = await fetch(`http://37.27.210.128:8080/api/photos/${category}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch photos")
      }

      const data = await response.json()
      setPhotos(data.data || [])
    } catch (error) {
      console.error("Error fetching photos:", error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    setUploadError(null)
    setUploadSuccess(null)

    if (!file) {
      setUploadError("Please select a file to upload")
      return
    }

    if (!photoTitle.trim()) {
      setUploadError("Please provide a title for the photo")
      return
    }

    const token = localStorage.getItem("token")
    if (!token) return

    const formData = new FormData()
    formData.append("photo", file)
    formData.append("title", photoTitle)
    formData.append("category", selectedCategory)

    try {
      const response = await fetch("http://37.27.210.128:8080/api/photos/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to upload photo")
      }

      setUploadSuccess("Photo uploaded successfully")
      setFile(null)
      setPhotoTitle("")

      // Refresh the photos list
      fetchPhotos(selectedCategory)
    } catch (error) {
      console.error("Error uploading photo:", error)
      setUploadError(error instanceof Error ? error.message : "Failed to upload photo")
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      const response = await fetch(`http://37.27.210.128:8080/api/photos/${photoId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete photo")
      }

      // Refresh the photos list
      fetchPhotos(selectedCategory)
    } catch (error) {
      console.error("Error deleting photo:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-4 pt-16">
      <div className="container mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src="/placeholder.svg?height=48&width=48" alt={user?.name} />
                <AvatarFallback className="bg-zinc-700 text-sm">
                  {user?.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-zinc-400">Logged in as {user?.name}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Link href="/">
                <Button variant="outline" className="border-zinc-700 text-white">
                  View Site
                </Button>
              </Link>
              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <Card className="mb-8 border-zinc-800 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>Manage Photos</CardTitle>
              <CardDescription className="text-zinc-400">
                Upload, manage, and organize your portfolio photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <Label htmlFor="category-select">Select Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="mt-2 border-zinc-700 bg-zinc-800">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-900">
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Upload New Photo</h3>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="photo-title">Photo Title</Label>
                      <Input
                        id="photo-title"
                        value={photoTitle}
                        onChange={(e) => setPhotoTitle(e.target.value)}
                        className="mt-1 border-zinc-700 bg-zinc-800"
                        placeholder="Enter a title for the photo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="photo-upload">Select Photo</Label>
                      <Input
                        id="photo-upload"
                        type="file"
                        onChange={handleFileChange}
                        className="mt-1 border-zinc-700 bg-zinc-800"
                        accept="image/*"
                      />
                    </div>
                    {uploadError && (
                      <Alert variant="destructive" className="bg-red-900/20 text-red-300">
                        <AlertDescription>{uploadError}</AlertDescription>
                      </Alert>
                    )}
                    {uploadSuccess && (
                      <Alert className="bg-green-900/20 text-green-300">
                        <AlertDescription>{uploadSuccess}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleUpload} className="h-10">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Photo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="mb-4 text-lg font-medium">
                  {categories.find((c) => c.value === selectedCategory)?.label || "Photos"}
                </h3>
                {photos.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-700 p-8 text-center">
                    <p className="text-zinc-400">No photos found in this category</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {photos.map((photo) => (
                      <Card key={photo.id} className="overflow-hidden border-zinc-800 bg-zinc-900">
                        <CardContent className="p-0">
                          <div className="group relative">
                            <img
                              src={photo.url || "/placeholder.svg"}
                              alt={photo.title}
                              className="aspect-[4/3] w-full object-cover"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <h3 className="text-xl font-semibold text-white">{photo.title}</h3>
                              <p className="mt-2 text-sm text-gray-300">
                                {new Date(photo.uploadDate).toLocaleDateString()}
                              </p>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="mt-4"
                                onClick={() => handleDeletePhoto(photo.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}


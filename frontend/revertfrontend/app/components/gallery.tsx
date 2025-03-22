
"use client"

import { motion } from "framer-motion"
import { useRef, useState, useEffect } from "react"
import { useInView } from "framer-motion"

interface FeaturedWork {
  id: string
  title: string
  url: string
  filename: string
}

export default function Gallery() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [featuredWorks, setFeaturedWorks] = useState<FeaturedWork[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFeaturedWorks = async () => {
      try {
        const response = await fetch("http://37.27.210.128:8080/api/photos/featured")

        if (!response.ok) {
          throw new Error("Failed to fetch featured works")
        }

        const data = await response.json()
        setFeaturedWorks(data.data || [])
      } catch (error) {
        console.error("Error fetching featured works:", error)
        // Fallback to default images if API fails
        setFeaturedWorks([
          {
            id: "1",
            title: "Digital Exploration",
            url: "/placeholder.svg?height=600&width=400",
            filename: "digital-exploration.jpg",
          },
          {
            id: "2",
            title: "Urban Notes",
            url: "/placeholder.svg?height=600&width=400",
            filename: "urban-notes.jpg",
          },
          {
            id: "3",
            title: "Natural Patterns",
            url: "/placeholder.svg?height=600&width=400",
            filename: "natural-patterns.jpg",
          },
          {
            id: "4",
            title: "Digital Portrait",
            url: "/placeholder.svg?height=600&width=400",
            filename: "digital-portrait.jpg",
          },
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedWorks()
  }, [])

  if (isLoading) {
    return (
      <section className="relative py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">Loading featured works...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-20">
      <div ref={ref} className="container mx-auto px-4">
        <motion.h2
          className="mb-12 text-center text-3xl font-bold tracking-tighter sm:text-4xl"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          Featured Works
        </motion.h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {featuredWorks.map((image, index) => (
            <motion.div
              key={image.id}
              className="group relative overflow-hidden rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
            >
              <div className="aspect-[2/3] overflow-hidden">
                <img
                  src={image.url || "/placeholder.svg"}
                  alt={image.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <h3 className="text-xl font-semibold text-white">{image.title}</h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


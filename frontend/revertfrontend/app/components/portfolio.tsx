
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface WorkItem {
  id: string
  title: string
  category: string
  url: string
  uploadDate: string
}

export default function Portfolio() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [portfolioWorks, setPortfolioWorks] = useState<WorkItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const categories = ["all", "digital-sketches", "notebook-sketches", "photography"]

  useEffect(() => {
    const fetchPortfolioWorks = async () => {
      try {
        // Fetch all categories
        const fetchPromises = categories
          .filter((cat) => cat !== "all")
          .map((category) =>
            fetch(`http://37.27.210.128:8080/api/photos/${category}`)
              .then((res) => res.json())
              .then((data) => data.data || []),
          )

        const results = await Promise.all(fetchPromises)

        // Combine all results
        const allWorks = results.flat()
        setPortfolioWorks(allWorks)
      } catch (error) {
        console.error("Failed to load portfolio works:", error)
        // Fallback data if API fails
        setPortfolioWorks([
          {
            id: "1",
            title: "Digital Landscape",
            category: "digital-sketches",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2024-01-15",
          },
          {
            id: "2",
            title: "Cafe Sketches",
            category: "notebook-sketches",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2023-11-20",
          },
          {
            id: "3",
            title: "Urban Shadows",
            category: "photography",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2024-02-05",
          },
          {
            id: "4",
            title: "Character Design",
            category: "digital-sketches",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2023-09-12",
          },
          {
            id: "5",
            title: "Travel Journal",
            category: "notebook-sketches",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2024-03-01",
          },
          {
            id: "6",
            title: "Street Photography",
            category: "photography",
            url: "/placeholder.svg?height=400&width=600",
            uploadDate: "2023-08-18",
          },
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPortfolioWorks()
  }, [])

  const filteredWorks = portfolioWorks.filter((work) =>
    selectedCategory === "all" ? true : work.category === selectedCategory,
  )

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "digital-sketches":
        return "Digital Sketches"
      case "notebook-sketches":
        return "Notebook Sketches"
      case "photography":
        return "Photography"
      default:
        return category.charAt(0).toUpperCase() + category.slice(1)
    }
  }

  if (isLoading) {
    return (
      <section className="bg-black py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">Loading portfolio works...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-black py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12 flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="text-sm capitalize"
            >
              {getCategoryLabel(category)}
            </Button>
          ))}
        </div>
        <motion.div layout className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredWorks.map((work) => (
              <motion.div
                key={work.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="overflow-hidden bg-zinc-900">
                  <CardContent className="p-0">
                    <div className="group relative">
                      <img
                        src={work.url || "/placeholder.svg"}
                        alt={work.title}
                        className="w-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <h3 className="text-xl font-semibold text-white">{work.title}</h3>
                        <p className="mt-2 text-sm text-gray-300">{new Date(work.uploadDate).getFullYear()}</p>
                        <p className="mt-1 text-xs text-gray-400">{getCategoryLabel(work.category)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}


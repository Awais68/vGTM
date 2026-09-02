"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info } from "lucide-react"

export function Header() {
  return (
    <header className="h-16 bg-cyan-500 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="text-white hover:bg-cyan-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select defaultValue="peak-corporate">
          <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="peak-corporate">Peak Corporate Solution</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" className="text-white hover:bg-cyan-600">
          <Info className="w-4 h-4" />
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-gray-700 text-white text-sm">JD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

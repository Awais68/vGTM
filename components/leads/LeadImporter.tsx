"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"

interface CampaignOption {
  id: string
  name: string
}

interface CsvPreviewRow {
  firstName: string
  lastName: string
  email: string
  linkedinUrl: string
  company: string
  jobTitle: string
}

interface ImportResults {
  imported: number
  updated: number
  failed: number
  errors: Array<{ row: number; message: string }>
}

interface LeadImporterProps {
  campaignId?: string
  onImported?: (results: ImportResults) => void
}

export function LeadImporter({ campaignId, onImported }: LeadImporterProps = {}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CsvPreviewRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaignId ?? "")
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (campaignId) return
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/campaigns")
        if (response.ok) {
          const json = await response.json()
          const data = json.data ?? json
          setCampaigns(
            Array.isArray(data)
              ? data.map((c: { id: string; name: string }) => ({
                  id: c.id,
                  name: c.name,
                }))
              : []
          )
        }
      } catch {
        setCampaigns([])
      }
    }
    fetchCampaigns()
  }, [campaignId])

  const parsePreview = useCallback((text: string) => {
    const lines = text.trim().split("\n")
    if (lines.length < 2) return

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const fni = headers.indexOf("firstname")
    const lni = headers.indexOf("lastname")
    const emi = headers.indexOf("email")
    const lii = headers.indexOf("linkedinurl")
    const coi = headers.indexOf("company")
    const jti = headers.indexOf("jobtitle")

    const rows: CsvPreviewRow[] = []
    const maxPreview = Math.min(lines.length - 1, 5)

    for (let i = 1; i <= maxPreview; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      rows.push({
        firstName: fni !== -1 ? cols[fni] ?? "" : "",
        lastName: lni !== -1 ? cols[lni] ?? "" : "",
        email: emi !== -1 ? cols[emi] ?? "" : "",
        linkedinUrl: lii !== -1 ? cols[lii] ?? "" : "",
        company: coi !== -1 ? cols[coi] ?? "" : "",
        jobTitle: jti !== -1 ? cols[jti] ?? "" : "",
      })
    }
    setPreview(rows)
  }, [])

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return
    setFile(file)
    setResults(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parsePreview(text)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (selectedCampaign) formData.append("campaignId", selectedCampaign)

      const response = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      })

      const json = await response.json()

      if (json.success) {
        setResults(json.data)
        onImported?.(json.data)
      } else {
        setResults({
          imported: 0,
          updated: 0,
          failed: 0,
          errors: [{ row: 0, message: json.error ?? "Import failed" }],
        })
      }
    } catch {
      setResults({
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [{ row: 0, message: "Network error during import" }],
      })
    } finally {
      setImporting(false)
    }
  }

  function downloadErrorReport() {
    if (!results || results.errors.length === 0) return
    const rows = results.errors.map((e) => `Row ${e.row}: ${e.message}`)
    const blob = new Blob(["Error Report\n" + rows.join("\n")], {
      type: "text/plain",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "import-errors.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="hidden"
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Drop a CSV file here, or click to select
                </p>
                <p className="text-xs text-gray-400">
                  Expected columns: firstName, lastName, email, linkedinUrl,
                  company, jobTitle
                </p>
              </div>
            )}
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Preview (first {preview.length} rows)
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {row.email}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {row.linkedinUrl}
                        </TableCell>
                        <TableCell>{row.company}</TableCell>
                        <TableCell>{row.jobTitle}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!campaignId && (
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign (optional)</Label>
              <Select
                value={selectedCampaign}
                onValueChange={setSelectedCampaign}
              >
                <SelectTrigger id="campaign" className="w-full">
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full"
          >
            {importing ? "Importing..." : "Import Leads"}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default" className="text-sm px-3 py-1">
                {results.imported} imported
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {results.updated} updated
              </Badge>
              <Badge
                variant={results.failed > 0 ? "destructive" : "outline"}
                className="text-sm px-3 py-1"
              >
                {results.failed} failed
              </Badge>
            </div>
            {results.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  {results.errors.length} error(s) occurred
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadErrorReport}
                >
                  Download Error Report
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

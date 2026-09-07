"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react"

const ACCEPTED = ".csv,.tsv,.txt,.xlsx,.xlsm,.json,.jsonl,.ndjson,.pdf,.docx"

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  linkedinUrl: "LinkedIn URL",
  company: "Company",
  jobTitle: "Job title",
  phone: "Phone",
  location: "Location",
  industry: "Industry",
}

const NONE = "__none__"

interface CampaignOption {
  id: string
  name: string
}

interface PreviewData {
  fileName: string
  fileType: string
  source: string
  columns: string[]
  supportedFields: string[]
  mapping: Record<string, string>
  totalRows: number
  sample: Record<string, string>[]
  validCount: number
  duplicatesInFile: number
  errors: Array<{ row: number; message: string }>
  warnings: string[]
  sheets: string[] | null
  extraction: { method: "ai" | "heuristic"; count: number } | null
}

interface ImportResults {
  imported: number
  updated: number
  skipped: number
  failed: number
  duplicatesInFile?: number
  fileType?: string
  warnings?: string[]
  errors: Array<{ row: number; message: string }>
  heyreach?: { addedLeadsCount: number; updatedLeadsCount: number; failedLeadsCount: number } | null
  automation?: { rulesRun: number; affected: number } | null
}

interface LeadImporterProps {
  campaignId?: string
  onImported?: (results: ImportResults) => void
}

export function LeadImporter({ campaignId, onImported }: LeadImporterProps = {}) {
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState("")
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>(campaignId ?? "")
  const [updateExisting, setUpdateExisting] = useState(true)
  const [keepExtraColumns, setKeepExtraColumns] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (campaignId) return
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/campaigns")
        if (!response.ok) return
        const json = await response.json()
        const data = json.data ?? json
        if (!cancelled && Array.isArray(data)) {
          setCampaigns(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
        }
      } catch {
        /* the campaign picker is optional — leads can be imported unassigned */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const buildFormData = useCallback(() => {
    const formData = new FormData()
    if (file) formData.append("file", file)
    else if (pastedText.trim()) formData.append("text", pastedText)
    return formData
  }, [file, pastedText])

  const analyse = useCallback(
    async (nextFile?: File | null, text?: string) => {
      const formData = new FormData()
      if (nextFile) formData.append("file", nextFile)
      else if (text?.trim()) formData.append("text", text)
      else return

      setAnalysing(true)
      setError(null)
      setResults(null)

      try {
        const response = await fetch("/api/leads/import/preview", { method: "POST", body: formData })
        const json = await response.json()

        if (!response.ok || !json.success) {
          setPreview(null)
          setError(json.error ?? "Could not read this file")
          return
        }

        setPreview(json.data as PreviewData)
        setMapping(json.data.mapping ?? {})
      } catch {
        setError("Network error while reading the file")
      } finally {
        setAnalysing(false)
      }
    },
    []
  )

  const handleFile = useCallback(
    (nextFile: File | null) => {
      setFile(nextFile)
      setPastedText("")
      setPreview(null)
      if (nextFile) void analyse(nextFile)
    },
    [analyse]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragOver(false)
      const dropped = event.dataTransfer.files?.[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile]
  )

  const reset = () => {
    setFile(null)
    setPastedText("")
    setPreview(null)
    setMapping({})
    setResults(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const runImport = async () => {
    if (!preview) return
    setImporting(true)
    setError(null)

    try {
      const formData = buildFormData()
      formData.append("mapping", JSON.stringify(mapping))
      if (selectedCampaign) formData.append("campaignId", selectedCampaign)
      formData.append("updateExisting", String(updateExisting))
      formData.append("keepUnmappedColumns", String(keepExtraColumns))

      const response = await fetch("/api/leads/import", { method: "POST", body: formData })
      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.error ?? "Import failed")
        return
      }

      setResults(json.data as ImportResults)
      onImported?.(json.data as ImportResults)
    } catch {
      setError("Network error during import")
    } finally {
      setImporting(false)
    }
  }

  const mappedFields = useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping]
  )

  const canImport =
    !!preview &&
    preview.validCount > 0 &&
    (!!mapping.firstName || !!mapping.fullName) &&
    (!!mapping.email || !!mapping.linkedinUrl)

  if (results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Import finished
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Imported" value={results.imported} tone="green" />
            <Stat label="Updated" value={results.updated} tone="blue" />
            <Stat label="Skipped" value={results.skipped + (results.duplicatesInFile ?? 0)} tone="gray" />
            <Stat label="Failed" value={results.failed} tone="red" />
          </div>

          {results.heyreach && (
            <p className="text-sm text-gray-600">
              Pushed to HeyReach: {results.heyreach.addedLeadsCount} added,{" "}
              {results.heyreach.updatedLeadsCount} updated, {results.heyreach.failedLeadsCount} failed.
            </p>
          )}

          {results.automation && results.automation.rulesRun > 0 && (
            <p className="text-sm text-gray-600">
              Automation ran {results.automation.rulesRun} rule(s) and touched {results.automation.affected} leads.
            </p>
          )}

          {results.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-48 overflow-auto">
              <p className="text-sm font-medium text-amber-800 mb-2">
                {results.errors.length} row problem{results.errors.length === 1 ? "" : "s"}
              </p>
              <ul className="text-xs text-amber-700 space-y-1">
                {results.errors.slice(0, 30).map((rowError, index) => (
                  <li key={index}>
                    {rowError.row > 0 ? `Row ${rowError.row}: ` : ""}
                    {rowError.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button onClick={reset} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Import another file
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Import leads</CardTitle>
          <div className="flex gap-2">
            <a href="/api/leads/import/template?format=csv" download>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                CSV template
              </Button>
            </a>
            <a href="/api/leads/import/template?format=xlsx" download>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Excel template
              </Button>
            </a>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="file">
            <TabsList className="mb-4">
              <TabsTrigger value="file">Upload a file</TabsTrigger>
              <TabsTrigger value="paste">Paste a list</TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver ? "border-cyan-500 bg-cyan-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <Upload className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                <p className="font-medium">
                  {file ? file.name : "Drop a file here, or click to choose"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  CSV · Excel (.xlsx) · JSON · PDF · Word (.docx) · plain text — up to 20MB
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  PDF and Word files have no columns, so the text is read and the people in it are
                  extracted automatically.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </TabsContent>

            <TabsContent value="paste" className="space-y-3">
              <Textarea
                rows={8}
                placeholder={"Paste rows, an email list, or a block of text.\n\nJane Doe — Head of Growth at Acme — jane@acme.com"}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!pastedText.trim() || analysing}
                onClick={() => {
                  setFile(null)
                  void analyse(null, pastedText)
                }}
              >
                {analysing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Read this list
              </Button>
            </TabsContent>
          </Tabs>

          {analysing && (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the file…
            </p>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {preview.fileType === "pdf" || preview.fileType === "docx" ? (
                <FileText className="h-4 w-4" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {preview.fileName}
              <Badge variant="outline">{preview.fileType.toUpperCase()}</Badge>
              {preview.extraction && (
                <Badge className="bg-purple-100 text-purple-800">
                  {preview.extraction.method === "ai" ? "AI extracted" : "Pattern matched"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Rows read" value={preview.totalRows} tone="gray" />
              <Stat label="Importable" value={preview.validCount} tone="green" />
              <Stat label="Duplicates in file" value={preview.duplicatesInFile} tone="blue" />
              <Stat label="Row problems" value={preview.errors.length} tone="red" />
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <ul className="space-y-1">
                  {preview.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">Column mapping</Label>
                <span className="text-xs text-gray-500">{mappedFields} of {preview.columns.length} columns used</span>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                A lead needs a name plus an email or a LinkedIn URL. Everything else is optional.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {preview.supportedFields.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-28 flex-shrink-0 text-sm">
                      {FIELD_LABELS[field] ?? field}
                      {(field === "firstName" || field === "email") && (
                        <span className="ml-1 text-gray-400">*</span>
                      )}
                    </Label>
                    <Select
                      value={mapping[field] ?? NONE}
                      onValueChange={(value) =>
                        setMapping((prev) => {
                          const next = { ...prev }
                          if (value === NONE) delete next[field]
                          else next[field] = value
                          return next
                        })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not mapped</SelectItem>
                        {preview.columns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {!canImport && preview.validCount > 0 && (
                <p className="mt-3 text-sm text-amber-700">
                  Map a name column and either Email or LinkedIn URL before importing.
                </p>
              )}
            </div>

            {preview.sample.length > 0 && (
              <div>
                <Label className="mb-2 block text-sm font-medium">
                  Preview — first {preview.sample.length} rows
                </Label>
                <div className="max-h-72 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.columns.slice(0, 8).map((column) => (
                          <TableHead key={column} className="whitespace-nowrap">
                            {column}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.map((row, index) => (
                        <TableRow key={index}>
                          {preview.columns.slice(0, 8).map((column) => (
                            <TableCell key={column} className="max-w-48 truncate text-sm">
                              {row[column]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {preview.errors.length > 0 && (
              <details className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-amber-800">
                  {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} will be skipped
                </summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-amber-700">
                  {preview.errors.map((rowError, index) => (
                    <li key={index}>Row {rowError.row}: {rowError.message}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="space-y-3 border-t pt-4">
              {!campaignId && (
                <div className="flex items-center gap-2">
                  <Label className="w-28 flex-shrink-0 text-sm">Campaign</Label>
                  <Select
                    value={selectedCampaign || NONE}
                    onValueChange={(value) => setSelectedCampaign(value === NONE ? "" : value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="No campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No campaign (add to leads only)</SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                />
                Update leads we already have (off = only add new people)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={keepExtraColumns}
                  onCheckedChange={(checked) => setKeepExtraColumns(checked === true)}
                />
                Keep unmapped columns as custom fields
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={runImport} disabled={!canImport || importing} className="bg-cyan-500 hover:bg-cyan-600">
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {preview.validCount} lead{preview.validCount === 1 ? "" : "s"}
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "red" | "gray" }) {
  const tones = {
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  }
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  )
}

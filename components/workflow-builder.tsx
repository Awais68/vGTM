"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Edit } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WorkflowNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  connections: string[]
  isVisible: boolean
}

const nodeTypes = [
  { value: "campaign-start", label: "Campaign Start", color: "bg-blue-100 border-blue-300" },
  { value: "if-connection", label: "If Connection", color: "bg-purple-100 border-purple-300" },
  { value: "not-connected", label: "Not Connected", color: "bg-gray-100 border-gray-300" },
  { value: "connected", label: "Connected", color: "bg-green-100 border-green-300" },
  { value: "no-delay", label: "No Delay", color: "bg-yellow-100 border-yellow-300" },
  { value: "delay", label: "1 Day", color: "bg-orange-100 border-orange-300" },
  { value: "view-profile", label: "View Profile", color: "bg-indigo-100 border-indigo-300" },
  { value: "send-message", label: "Send Message", color: "bg-pink-100 border-pink-300" },
  { value: "replied", label: "Replied", color: "bg-green-100 border-green-300" },
  { value: "no-reply", label: "No Reply Yet", color: "bg-gray-100 border-gray-300" },
  { value: "end", label: "End", color: "bg-red-100 border-red-300" },
]

export function WorkflowBuilder() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: "start", type: "campaign-start", label: "Campaign Start", x: 400, y: 50, connections: [], isVisible: true },
  ])

  const [selectedNodeType, setSelectedNodeType] = useState("")
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [selectedNodeForConnection, setSelectedNodeForConnection] = useState<string | null>(null)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const getNodeStyle = (type: string) => {
    const nodeType = nodeTypes.find((nt) => nt.value === type)
    return nodeType?.color || "bg-gray-100 border-gray-300"
  }

  const addNode = useCallback(() => {
    if (!selectedNodeType) return

    const visibleNodes = nodes.filter((n) => n.isVisible)
    const lastNode = visibleNodes[visibleNodes.length - 1]

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: selectedNodeType,
      label: nodeTypes.find((nt) => nt.value === selectedNodeType)?.label || "New Node",
      x: lastNode ? lastNode.x : 400,
      y: lastNode ? lastNode.y + 120 : 150,
      connections: [],
      isVisible: true,
    }

    setNodes((prev) => [...prev, newNode])
    setSelectedNodeType("")
    setShowAddMenu(false)
  }, [selectedNodeType, nodes])

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === "start") return // Prevent deleting start node

    setNodes((prev) =>
      prev
        .filter((node) => node.id !== nodeId)
        .map((node) => ({
          ...node,
          connections: node.connections.filter((connId) => connId !== nodeId),
        })),
    )
  }, [])

  const connectNodes = useCallback((fromNodeId: string, toNodeId: string) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === fromNodeId
          ? { ...node, connections: [...node.connections.filter((id) => id !== toNodeId), toNodeId] }
          : node,
      ),
    )
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDraggedNode(nodeId)
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggedNode) return

      const container = e.currentTarget.getBoundingClientRect()
      const newX = e.clientX - container.left - dragOffset.x
      const newY = e.clientY - container.top - dragOffset.y

      setNodes((prev) =>
        prev.map((node) =>
          node.id === draggedNode
            ? {
                ...node,
                x: Math.max(0, Math.min(newX, container.width - 150)),
                y: Math.max(0, Math.min(newY, container.height - 80)),
              }
            : node,
        ),
      )
    },
    [draggedNode, dragOffset],
  )

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null)
  }, [])

  const addIfConnectionNode = useCallback(() => {
    const startNode = nodes.find((n) => n.id === "start")
    if (!startNode) return

    const ifConnNode: WorkflowNode = {
      id: "if-conn",
      type: "if-connection",
      label: "If Connection",
      x: startNode.x,
      y: startNode.y + 120,
      connections: [],
      isVisible: true,
    }

    setNodes((prev) => [
      ...prev.map((node) => (node.id === "start" ? { ...node, connections: [...node.connections, "if-conn"] } : node)),
      ifConnNode,
    ])
  }, [nodes])

  const addBranchNodes = useCallback(
    (parentId: string) => {
      const parentNode = nodes.find((n) => n.id === parentId)
      if (!parentNode) return

      const notConnectedNode: WorkflowNode = {
        id: `not-conn-${Date.now()}`,
        type: "not-connected",
        label: "Not Connected",
        x: parentNode.x - 150,
        y: parentNode.y + 120,
        connections: [],
        isVisible: true,
      }

      const connectedNode: WorkflowNode = {
        id: `conn-${Date.now()}`,
        type: "connected",
        label: "Connected",
        x: parentNode.x + 150,
        y: parentNode.y + 120,
        connections: [],
        isVisible: true,
      }

      setNodes((prev) => [
        ...prev.map((node) =>
          node.id === parentId ? { ...node, connections: [notConnectedNode.id, connectedNode.id] } : node,
        ),
        notConnectedNode,
        connectedNode,
      ])
    },
    [nodes],
  )

  const renderConnections = () => {
    return nodes
      .filter((n) => n.isVisible)
      .flatMap((node) =>
        node.connections.map((connId) => {
          const targetNode = nodes.find((n) => n.id === connId && n.isVisible)
          if (!targetNode) return null

          return (
            <line
              key={`${node.id}-${connId}`}
              x1={node.x + 75}
              y1={node.y + 40}
              x2={targetNode.x + 75}
              y2={targetNode.y}
              stroke="#94a3b8"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          )
        }),
      )
      .filter(Boolean)
  }

  const visibleNodes = nodes.filter((n) => n.isVisible)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">100%</span>
          <Button variant="outline" size="sm">
            -
          </Button>
          <Button variant="outline" size="sm">
            +
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600">Continue</Button>
        </div>
      </div>

      <div
        className="relative bg-gray-50 rounded-lg p-4 min-h-[600px] overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          {renderConnections()}
        </svg>

        {visibleNodes.map((node) => (
          <div
            key={node.id}
            className={`absolute border-2 rounded-lg p-3 min-w-[150px] text-center cursor-move select-none ${getNodeStyle(node.type)} ${
              selectedNodeForConnection === node.id ? "ring-2 ring-cyan-500" : ""
            }`}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => {
              if (selectedNodeForConnection && selectedNodeForConnection !== node.id) {
                connectNodes(selectedNodeForConnection, node.id)
                setSelectedNodeForConnection(null)
              } else {
                setSelectedNodeForConnection(node.id)
              }
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">{node.label}</span>
              {node.type !== "campaign-start" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNode(node.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {node.type === "campaign-start" && node.connections.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs mt-1 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  addIfConnectionNode()
                }}
              >
                + If Connection
              </Button>
            )}

            {node.type === "if-connection" && node.connections.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs mt-1 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation()
                  addBranchNodes(node.id)
                }}
              >
                + Add Branches
              </Button>
            )}

            {(node.type === "view-profile" || node.type === "send-message") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs mt-1"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNode(node.id)
                }}
              >
                ✕
              </Button>
            )}
          </div>
        ))}

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          {!showAddMenu ? (
            <Button onClick={() => setShowAddMenu(true)} className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" />
              Add action
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-lg">
              <Select value={selectedNodeType} onValueChange={setSelectedNodeType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select node type" />
                </SelectTrigger>
                <SelectContent>
                  {nodeTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addNode} disabled={!selectedNodeType} size="sm">
                Add
              </Button>
              <Button variant="outline" onClick={() => setShowAddMenu(false)} size="sm">
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4">
          <Button
            variant="outline"
            className="bg-white"
            onClick={() => {
              const endNode: WorkflowNode = {
                id: `end-${Date.now()}`,
                type: "end",
                label: "End",
                x: 400,
                y: Math.max(...visibleNodes.map((n) => n.y)) + 120,
                connections: [],
                isVisible: true,
              }
              setNodes((prev) => [...prev, endNode])
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            End
          </Button>
        </div>

        {selectedNodeForConnection && (
          <div className="absolute top-4 left-4 bg-cyan-100 border border-cyan-300 rounded-lg p-3 text-sm">
            <p className="font-medium text-cyan-800">Connection Mode</p>
            <p className="text-cyan-700">Click another node to connect, or click the same node to cancel.</p>
          </div>
        )}
      </div>
    </div>
  )
}

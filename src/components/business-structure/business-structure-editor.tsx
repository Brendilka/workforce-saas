"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Save, X, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BusinessUnit {
  id: string;
  name: string;
  level: number;
  positionX: number;
  positionY: number;
  costCenterCode?: string;
  costCenterName?: string;
}

interface Relationship {
  id: string;
  parentId: string;
  childId: string;
}

interface BusinessStructureEditorProps {
  structureName: string;
  structureDescription?: string | null;
  onSave: (data: {
    units: BusinessUnit[];
    relationships: Relationship[];
    levels: number;
    levelNames: Record<number, string>;
    description: string;
  }) => Promise<void>;
  onUpdateName: (name: string) => Promise<void>;
  onClose: () => void;
  initialData?: {
    units: BusinessUnit[];
    relationships: Relationship[];
    levels: number;
    levelNames?: Record<number, string>;
  };
}

export function BusinessStructureEditor({
  structureName,
  structureDescription,
  onSave,
  onUpdateName,
  onClose,
  initialData,
}: BusinessStructureEditorProps) {
  const [currentName, setCurrentName] = useState(structureName);
  const [description, setDescription] = useState(structureDescription || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [levels, setLevels] = useState(initialData?.levels || 10);
  const [units, setUnits] = useState<BusinessUnit[]>(initialData?.units || []);
  const [shouldRedistribute, setShouldRedistribute] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>(
    initialData?.relationships || []
  );
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [levelNames, setLevelNames] = useState<Record<number, string>>(initialData?.levelNames || {});
  const [showLevelPrompt, setShowLevelPrompt] = useState(false);
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const LEVEL_HEIGHT = 100;
  const UNIT_WIDTH = 180;
  const UNIT_HEIGHT = 60;
  const RIGHT_MARGIN = 200; // Space reserved for "Add Unit" button
  const UNIT_GAP = 40; // Gap between units
  const LEFT_MARGIN = 120; // Starting position

  // Progressive sizing strategy for level
  const getLevelSizing = (unitsOnLevel: number) => {
    if (typeof window === 'undefined' || unitsOnLevel === 0) {
      return { width: UNIT_WIDTH, gap: UNIT_GAP, fontSize: 14, allowOverlap: false, overlapPercent: 0 };
    }

    const availableWidth = window.innerWidth - LEFT_MARGIN - RIGHT_MARGIN;
    const MIN_GAP = 10; // Minimum gap between tiles
    const MIN_WIDTH = 80; // Minimum tile width before allowing overlap
    const MIN_FONT_SIZE = 9; // Minimum readable font size
    
    // Strategy 1: Try with default width and reduce gaps
    let gap = UNIT_GAP;
    let width = UNIT_WIDTH;
    let totalNeeded = (unitsOnLevel * width) + ((unitsOnLevel - 1) * gap);
    
    if (totalNeeded > availableWidth) {
      // Calculate gap needed
      gap = (availableWidth - (unitsOnLevel * width)) / Math.max(1, (unitsOnLevel - 1));
      
      // Strategy 2: If gap is too small, reduce tile width
      if (gap < MIN_GAP) {
        gap = MIN_GAP;
        width = (availableWidth - ((unitsOnLevel - 1) * gap)) / unitsOnLevel;
        
        // Strategy 3: If width is too small, allow controlled overlap (max 15%)
        if (width < MIN_WIDTH) {
          const maxOverlap = 0.15; // 15% max overlap
          width = MIN_WIDTH;
          const idealTotalWidth = (unitsOnLevel * width) - (unitsOnLevel - 1) * (width * maxOverlap);
          
          if (idealTotalWidth <= availableWidth) {
            // Calculate actual overlap needed
            const overlapPercent = Math.min(maxOverlap, 1 - (availableWidth - width) / ((unitsOnLevel - 1) * width));
            return { 
              width, 
              gap: -width * overlapPercent, 
              fontSize: MIN_FONT_SIZE, 
              allowOverlap: true, 
              overlapPercent 
            };
          }
        }
      }
    }
    
    // Calculate font size based on width (scale between 9px and 14px)
    const fontSize = Math.max(MIN_FONT_SIZE, Math.min(14, Math.floor(width / 12)));
    
    return { 
      width: Math.max(MIN_WIDTH, width), 
      gap: Math.max(0, gap), 
      fontSize, 
      allowOverlap: false, 
      overlapPercent: 0 
    };
  };

  // Calculate width for each unit based on its level
  const getUnitWidth = (unit: BusinessUnit): number => {
    const unitsOnLevel = units.filter(u => u.level === unit.level).length;
    return getLevelSizing(unitsOnLevel).width;
  };

  // Get font size for a unit
  const getUnitFontSize = (unit: BusinessUnit): number => {
    const unitsOnLevel = units.filter(u => u.level === unit.level).length;
    return getLevelSizing(unitsOnLevel).fontSize;
  };

  // Check if unit has any connections (parent or child)
  const hasConnections = (unitId: string): boolean => {
    return relationships.some(rel => rel.parentId === unitId || rel.childId === unitId);
  };

  // Check if unit has issues (no connections or no cost center)
  const getUnitWarnings = (unit: BusinessUnit): string[] => {
    const warnings: string[] = [];
    if (!hasConnections(unit.id)) {
      warnings.push("Orphaned business unit. Please add a link");
    }
    if (!unit.costCenterCode) {
      warnings.push("No cost center specified");
    }
    return warnings;
  };

  // Check if unit has any warnings
  const hasWarnings = (unit: BusinessUnit): boolean => {
    return getUnitWarnings(unit).length > 0;
  };

  // Redistribute units evenly on each level whenever unit count changes
  useEffect(() => {
    if (units.length === 0 || !shouldRedistribute) return;
    
    const redistributedUnits = units.map(unit => {
      const unitsOnLevel = units.filter(u => u.level === unit.level).sort((a, b) => a.positionX - b.positionX);
      const indexOnLevel = unitsOnLevel.findIndex(u => u.id === unit.id);
      const sizing = getLevelSizing(unitsOnLevel.length);
      
      if (indexOnLevel !== -1) {
        const newPositionX = LEFT_MARGIN + (indexOnLevel * (sizing.width + sizing.gap));
        if (Math.abs(newPositionX - unit.positionX) > 1) {
          return { ...unit, positionX: newPositionX };
        }
      }
      return unit;
    });
    
    // Only update if positions actually changed
    const positionsChanged = redistributedUnits.some((unit, idx) => 
      Math.abs(unit.positionX - units[idx].positionX) > 1
    );
    
    if (positionsChanged) {
      setUnits(redistributedUnits);
    }
    setShouldRedistribute(false);
  }, [units.length, shouldRedistribute]);

  const handleAddLevel = () => {
    setShowLevelPrompt(true);
  };

  const handleConfirmAddLevel = (name: string) => {
    const newLevelNumber = levels + 1;
    setLevels(newLevelNumber);
    if (name && name !== `Level ${newLevelNumber}`) {
      setLevelNames({ ...levelNames, [newLevelNumber]: name });
    }
    setShowLevelPrompt(false);
  };

  const handleUpdateLevelName = (levelNumber: number, name: string) => {
    if (name && name !== `Level ${levelNumber}`) {
      setLevelNames({ ...levelNames, [levelNumber]: name });
    } else {
      const { [levelNumber]: _, ...rest } = levelNames;
      setLevelNames(rest);
    }
    setEditingLevelIndex(null);
  };

  const getLevelName = (levelNumber: number) => {
    return levelNames[levelNumber] || `Level ${levelNumber}`;
  };

  const handleUpdateStructureName = async (name: string) => {
    if (name && name.trim() !== structureName) {
      setCurrentName(name);
      await onUpdateName(name);
    }
    setIsEditingName(false);
  };

  const handleAddUnit = (level: number) => {
    const existingUnitsAtLevel = units.filter((u) => u.level === level);
    
    // Calculate position based on existing units and level-specific sizing
    const sizing = getLevelSizing(existingUnitsAtLevel.length + 1);
    let positionX = LEFT_MARGIN; // Default starting position
    if (existingUnitsAtLevel.length > 0) {
      const rightmostUnit = existingUnitsAtLevel.reduce((max, unit) => 
        unit.positionX > max.positionX ? unit : max
      );
      positionX = rightmostUnit.positionX + sizing.width + sizing.gap;
    }
    
    // Center tile vertically between horizontal lines
    const positionY = (level - 1) * LEVEL_HEIGHT + (LEVEL_HEIGHT - UNIT_HEIGHT) / 2;

    setEditingUnit({
      id: `temp-${Date.now()}`,
      name: "",
      level,
      positionX,
      positionY,
    });
    setShowUnitForm(true);
  };

  const handleSaveUnit = (unitData: {
    name: string;
    level: number;
    costCenterCode?: string;
    costCenterName?: string;
  }) => {
    if (editingUnit) {
      const levelChanged = editingUnit.level !== unitData.level;
      const newPositionY = levelChanged ? (unitData.level - 1) * LEVEL_HEIGHT + (LEVEL_HEIGHT - UNIT_HEIGHT) / 2 : editingUnit.positionY;
      
      const newUnit: BusinessUnit = {
        ...editingUnit,
        id: editingUnit.id.startsWith("temp-")
          ? `unit-${Date.now()}`
          : editingUnit.id,
        name: unitData.name,
        level: unitData.level,
        positionY: newPositionY,
        costCenterCode: unitData.costCenterCode,
        costCenterName: unitData.costCenterName,
      };

      if (editingUnit.id.startsWith("temp-")) {
        setUnits([...units, newUnit]);
        setShouldRedistribute(true);
      } else {
        setUnits(units.map((u) => (u.id === editingUnit.id ? newUnit : u)));
        // Only redistribute if level changed
        if (levelChanged) {
          setShouldRedistribute(true);
        }
      }
    }
    setShowUnitForm(false);
    setEditingUnit(null);
  };

  const handleEditUnit = (unit: BusinessUnit) => {
    setEditingUnit(unit);
    setShowUnitForm(true);
  };

  const handleDeleteUnit = (unitId: string) => {
    setUnits(units.filter((u) => u.id !== unitId));
    setShouldRedistribute(true);
    setRelationships(
      relationships.filter(
        (r) => r.parentId !== unitId && r.childId !== unitId
      )
    );
    if (selectedUnit === unitId) setSelectedUnit(null);
  };

  const handleMouseDownOnUnit = (
    unitId: string,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scrollTop = canvasRef.current.scrollTop;
    const scrollLeft = canvasRef.current.scrollLeft;
    
    setIsDragging(unitId);
    setDragOffset({
      x: event.clientX - rect.left + scrollLeft - unit.positionX,
      y: event.clientY - rect.top + scrollTop - unit.positionY,
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollTop = canvasRef.current.scrollTop;
      const scrollLeft = canvasRef.current.scrollLeft;
      setMousePosition({
        x: event.clientX - rect.left + scrollLeft,
        y: event.clientY - rect.top + scrollTop,
      });
    }

    if (isDragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollTop = canvasRef.current.scrollTop;
      const scrollLeft = canvasRef.current.scrollLeft;
      const x = event.clientX - rect.left + scrollLeft - dragOffset.x;
      const y = event.clientY - rect.top + scrollTop - dragOffset.y;

      // Calculate which level this position corresponds to (1-based)
      const newLevel = Math.max(1, Math.min(levels, Math.round(y / LEVEL_HEIGHT) + 1));
      const snappedY = (newLevel - 1) * LEVEL_HEIGHT + (LEVEL_HEIGHT - UNIT_HEIGHT) / 2;

      setUnits(
        units.map((u) =>
          u.id === isDragging
            ? {
                ...u,
                positionX: Math.max(100, x),
                positionY: snappedY,
                level: newLevel,
              }
            : u
        )
      );
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleConnectClick = (unitId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(unitId);
    } else if (connectingFrom !== unitId) {
      const newRelationship: Relationship = {
        id: `rel-${Date.now()}`,
        parentId: connectingFrom,
        childId: unitId,
      };
      setRelationships([...relationships, newRelationship]);
      setConnectingFrom(null);
    } else {
      setConnectingFrom(null);
    }
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    setRelationships(relationships.filter((r) => r.id !== relationshipId));
  };

  const handleSaveStructure = async () => {
    setIsSaving(true);
    try {
      await onSave({ units, relationships, levels, levelNames, description });
    } finally {
      setIsSaving(false);
    }
  };

  const getUnitCenter = (unit: BusinessUnit) => ({
    x: unit.positionX + getUnitWidth(unit) / 2,
    y: unit.positionY + UNIT_HEIGHT / 2,
  });

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="flex items-center justify-between p-4">
          <div>
            {isEditingName ? (
              <input
                type="text"
                defaultValue={currentName}
                onBlur={(e) => handleUpdateStructureName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateStructureName(e.currentTarget.value);
                  }
                  if (e.key === 'Escape') {
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="text-2xl font-bold bg-white border border-gray-300 rounded px-2 py-1"
              />
            ) : (
              <h2
                className="text-2xl font-bold cursor-pointer hover:text-gray-700"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {currentName}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveStructure}
              disabled={isSaving}
              className="bg-admin hover:bg-admin/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Structure"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </div>
        <div className="px-4 pb-4">
          {isEditingDescription ? (
            <textarea
              defaultValue={description}
              onBlur={(e) => {
                setDescription(e.target.value);
                setIsEditingDescription(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  setDescription(e.currentTarget.value);
                  setIsEditingDescription(false);
                }
                if (e.key === 'Escape') {
                  setIsEditingDescription(false);
                }
              }}
              autoFocus
              placeholder="Add a description for this business structure..."
              className="text-sm text-gray-600 border border-gray-300 rounded px-2 py-1 w-full resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
              rows={2}
            />
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              className="text-sm text-gray-600 border border-gray-200 rounded px-2 py-1 w-full min-h-[56px] cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
              title="Click to edit description"
            >
              {description || (
                <span className="text-gray-400 italic">Add a description for this business structure...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddLevel}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Level
        </Button>
        <div className="text-sm text-muted-foreground">
          {units.length} units • {relationships.length} connections • {levels}{" "}
          levels
        </div>
        {connectingFrom && (
          <div className="ml-auto text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded">
            Connecting... Click another unit to create connection
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto relative bg-gray-50"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="relative"
          style={{ height: levels * LEVEL_HEIGHT + 200, paddingTop: 50 }}
        >
        {/* Level Lines */}
        {Array.from({ length: levels }).map((_, index) => (
          <div key={index}>
            {/* Horizontal dividing line */}
            <div
              className="absolute left-0 right-0 border-b border-gray-300"
              style={{ top: index * LEVEL_HEIGHT }}
            />
            {/* Clickable level area */}
            <div
              className="absolute left-0 right-0 cursor-pointer hover:bg-gray-100/50 transition-colors"
              style={{ 
                top: index * LEVEL_HEIGHT, 
                height: LEVEL_HEIGHT,
                zIndex: 0
              }}
              onClick={(e) => {
                // Only trigger if clicking on empty space (not on units or buttons)
                if (e.target === e.currentTarget) {
                  handleAddUnit(index + 1);
                }
              }}
            />
            {/* Level label and Add Unit button - centered between lines */}
            <div
              className="absolute left-0 right-0 flex items-center justify-between px-4 pointer-events-none"
              style={{ top: index * LEVEL_HEIGHT + LEVEL_HEIGHT / 2 - 12, zIndex: 1 }}
            >
              {editingLevelIndex === index + 1 ? (
                <input
                  type="text"
                  defaultValue={getLevelName(index + 1)}
                  onBlur={(e) => handleUpdateLevelName(index + 1, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateLevelName(index + 1, e.currentTarget.value);
                    }
                    if (e.key === 'Escape') {
                      setEditingLevelIndex(null);
                    }
                  }}
                  autoFocus
                  className="text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded px-2 py-1 pointer-events-auto"
                />
              ) : (
                <div
                  className="text-sm font-medium text-gray-600 cursor-pointer hover:text-gray-900 hover:underline pointer-events-auto"
                  onClick={() => setEditingLevelIndex(index + 1)}
                >
                  {getLevelName(index + 1)}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddUnit(index + 1)}
                className="text-xs h-7 pointer-events-auto"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Unit
              </Button>
            </div>
          </div>
        ))}

        {/* SVG for connections */}
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: levels * LEVEL_HEIGHT + 200 }}
        >
          {/* Live connection preview while connecting */}
          {connectingFrom && (() => {
            const fromUnit = units.find((u) => u.id === connectingFrom);
            if (!fromUnit) return null;
            const start = getUnitCenter(fromUnit);
            return (
              <line
                x1={start.x}
                y1={start.y}
                x2={mousePosition.x}
                y2={mousePosition.y}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead-preview)"
              />
            );
          })()}
          
          {relationships.map((rel) => {
            const parent = units.find((u) => u.id === rel.parentId);
            const child = units.find((u) => u.id === rel.childId);
            if (!parent || !child) return null;

            const start = getUnitCenter(parent);
            const end = getUnitCenter(child);

            return (
              <g key={rel.id}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#6b7280"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
                <circle
                  cx={(start.x + end.x) / 2}
                  cy={(start.y + end.y) / 2}
                  r="8"
                  fill="white"
                  stroke="#6b7280"
                  strokeWidth="2"
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => handleDeleteRelationship(rel.id)}
                />
                <text
                  x={(start.x + end.x) / 2}
                  y={(start.y + end.y) / 2 + 1}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                  className="pointer-events-none"
                >
                  ×
                </text>
              </g>
            );
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
            </marker>
            <marker
              id="arrowhead-preview"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
            </marker>
          </defs>
        </svg>

        {/* Business Units */}
        {units.map((unit) => {
          const warnings = getUnitWarnings(unit);
          const hasIssues = warnings.length > 0;
          const warningMessage = warnings.length > 0 
            ? warnings.length === 1 
              ? `Warning: ${warnings[0]}`
              : `Warning:\n${warnings.map(w => `- ${w}`).join('\n')}`
            : "";
          
          return (
          <div
            key={unit.id}
            className={cn(
              "absolute border-2 rounded-lg shadow-md p-2 cursor-move",
              selectedUnit === unit.id
                ? "border-admin"
                : connectingFrom === unit.id
                  ? "border-blue-500"
                  : hasIssues
                    ? "border-red-300"
                    : "border-gray-300",
              hasIssues ? "bg-red-50" : "bg-white",
              "hover:shadow-lg transition-shadow"
            )}
            style={{
              left: unit.positionX,
              top: unit.positionY,
              width: getUnitWidth(unit),
              height: UNIT_HEIGHT,
              zIndex: 10,
            }}
            title={warningMessage}
            onMouseDown={(e) => {
              if (!connectingFrom) {
                handleMouseDownOnUnit(unit.id, e);
              }
            }}
            onClick={(e) => {
              if (connectingFrom) {
                e.stopPropagation();
                handleConnectClick(unit.id);
              } else {
                setSelectedUnit(unit.id);
              }
            }}
          >
            <div className="flex flex-col h-full" style={{ fontSize: `${getUnitFontSize(unit)}px` }}>
              <div className="flex items-start justify-between">
                <div className="font-semibold truncate flex-1">
                  {unit.name}
                </div>
                <div className="flex gap-1">
                  <button
                    className={cn(
                      "text-xs px-1 rounded",
                      connectingFrom === unit.id
                        ? "bg-blue-500 text-white"
                        : "text-blue-600 hover:bg-blue-50"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnectClick(unit.id);
                    }}
                  >
                    🔗
                  </button>
                  <button
                    className="text-xs text-gray-600 hover:text-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditUnit(unit);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="text-xs text-red-600 hover:text-red-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUnit(unit.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {unit.costCenterCode && (
                <div className="mt-0.5 pt-0.5 border-t border-gray-200">
                  <div className="text-[10px] leading-tight truncate">
                    <span className="font-mono font-bold text-green-700">
                      {unit.costCenterCode}
                    </span>
                    {unit.costCenterName && (
                      <span className="text-gray-500 ml-1">
                        - {unit.costCenterName}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        })}
        </div>
      </div>

      {/* Add Level Prompt */}
      {showLevelPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add New Level</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get("levelName") as string;
                handleConfirmAddLevel(name || `Level ${levels + 1}`);
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="levelName">Level Name</Label>
                  <Input
                    id="levelName"
                    name="levelName"
                    placeholder={`Level ${levels + 1}`}
                    onFocus={(e) => {
                      if (e.target.value === `Level ${levels + 1}`) {
                        e.target.value = '';
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Press Enter to use default name or type a custom name
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLevelPrompt(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-admin hover:bg-admin/90">
                  Add Level
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Form Modal */}
      {showUnitForm && editingUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {editingUnit.id.startsWith("temp-")
                ? "Add Business Unit"
                : "Edit Business Unit"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSaveUnit({
                  name: formData.get("name") as string,
                  level: parseInt(formData.get("level") as string, 10),
                  costCenterCode: formData.get("costCenterCode") as string,
                  costCenterName: formData.get("costCenterName") as string,
                });
              }}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Unit Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingUnit.name}
                    required
                    placeholder="e.g., Sales Department"
                  />
                </div>
                <div>
                  <Label htmlFor="level">Level *</Label>
                  <Input
                    id="level"
                    name="level"
                    type="number"
                    min="1"
                    max={levels}
                    defaultValue={editingUnit.level}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="costCenterCode">Cost Center Code</Label>
                  <Input
                    id="costCenterCode"
                    name="costCenterCode"
                    defaultValue={editingUnit.costCenterCode}
                    placeholder="e.g., CC001"
                  />
                </div>
                <div>
                  <Label htmlFor="costCenterName">Cost Center Name</Label>
                  <Input
                    id="costCenterName"
                    name="costCenterName"
                    defaultValue={editingUnit.costCenterName}
                    placeholder="e.g., Sales Operations"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowUnitForm(false);
                    setEditingUnit(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-admin hover:bg-admin/90">
                  Save Unit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

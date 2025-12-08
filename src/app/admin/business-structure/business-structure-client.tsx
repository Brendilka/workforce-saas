"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { BusinessStructureEditor } from "@/components/business-structure/business-structure-editor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface BusinessStructure {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  max_levels: number | null;
  created_at: string | null;
  updated_at: string | null;
  units?: BusinessUnit[];
  relationships?: Relationship[];
  levelNames?: Record<number, string>;
}

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

interface LoadedStructureData {
  units: BusinessUnit[];
  relationships: Relationship[];
  levels: number;
  levelNames: Record<number, string>;
}

export function BusinessStructurePageClient() {
  const [structures, setStructures] = useState<BusinessStructure[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingStructure, setEditingStructure] = useState<BusinessStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStructureName, setNewStructureName] = useState("");
  const [newStructureDescription, setNewStructureDescription] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadStructures();
  }, []);

  const loadStructures = async () => {
    try {
      const { data, error } = await supabase
        .from("business_structures")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStructures(data || []);
    } catch (error) {
      console.error("Error loading structures:", error);
      toast.error("Failed to load business structures");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStructure = async () => {
    if (!newStructureName.trim()) {
      toast.error("Please enter a structure name");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const tenantId = user.user_metadata?.tenant_id;
      if (!tenantId) throw new Error("No tenant ID found");

      // Store description in JSON format to match save format
      const descriptionData = JSON.stringify({
        levelNames: {},
        description: newStructureDescription || ""
      });

      const { data, error } = await supabase
        .from("business_structures")
        .insert({
          tenant_id: tenantId,
          name: newStructureName,
          description: descriptionData,
          is_active: structures.length === 0, // First structure is active by default
          max_levels: 10,
        })
        .select()
        .single();

      if (error) throw error;

      // Parse description for editor
      let actualDescription = "";
      if (data.description) {
        try {
          const parsed = JSON.parse(data.description);
          actualDescription = parsed.description || "";
        } catch (e) {
          actualDescription = data.description;
        }
      }

      setEditingStructure({ ...data, actualDescription });
      setShowCreateDialog(false);
      setShowEditor(true);
      setNewStructureName("");
      setNewStructureDescription("");
      await loadStructures();
      toast.success("Business structure created");
    } catch (error) {
      console.error("Error creating structure:", error);
      toast.error("Failed to create business structure");
    }
  };

  const handleOpenEditor = async (structure: BusinessStructure) => {
    try {
      // Load units
      const { data: unitsData, error: unitsError } = await supabase
        .from("business_units")
        .select("*, cost_centers(code, name)")
        .eq("business_structure_id", structure.id);

      if (unitsError) throw unitsError;

      // Load relationships
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from("business_unit_relationships")
        .select("*")
        .eq("business_structure_id", structure.id);

      if (relationshipsError) throw relationshipsError;

      // Transform loaded data
      const units: BusinessUnit[] = (unitsData || []).map((unit: any) => ({
        id: unit.id,
        name: unit.name,
        level: unit.level,
        positionX: unit.position_x,
        positionY: unit.position_y,
        costCenterCode: unit.cost_centers?.code,
        costCenterName: unit.cost_centers?.name,
      }));

      const relationships: Relationship[] = (relationshipsData || []).map((rel: any) => ({
        id: rel.id,
        parentId: rel.parent_unit_id,
        childId: rel.child_unit_id,
      }));

      // Parse level names and description if stored
      let levelNames: Record<number, string> = {};
      let actualDescription = "";
      if (structure.description) {
        try {
          const parsed = JSON.parse(structure.description);
          if (parsed.levelNames) {
            levelNames = parsed.levelNames;
          }
          if (parsed.description) {
            actualDescription = parsed.description;
          }
        } catch (e) {
          // Description is not JSON, treat as plain text
          actualDescription = structure.description;
        }
      }

      setEditingStructure({ ...structure, units, relationships, levelNames, actualDescription });
      setShowEditor(true);
    } catch (error) {
      console.error("Error loading structure data:", error);
      toast.error("Failed to load structure data");
    }
  };

  const handleSaveStructure = async (structureData: {
    units: BusinessUnit[];
    relationships: Relationship[];
    levels: number;
    levelNames: Record<number, string>;
  }) => {
    if (!editingStructure) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const tenantId = user.user_metadata?.tenant_id;

      // Update max levels and store levelNames and description in JSON
      const descriptionData = JSON.stringify({ 
        levelNames: structureData.levelNames,
        description: structureData.description 
      });
      await supabase
        .from("business_structures")
        .update({ 
          max_levels: structureData.levels,
          description: descriptionData,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingStructure.id);

      // Delete existing units and relationships
      await supabase
        .from("business_units")
        .delete()
        .eq("business_structure_id", editingStructure.id);

      await supabase
        .from("business_unit_relationships")
        .delete()
        .eq("business_structure_id", editingStructure.id);

      // Create/update cost centers
      const costCenters = new Map<string, string>();
      for (const unit of structureData.units) {
        if (unit.costCenterCode) {
          const { data: existingCC } = await supabase
            .from("cost_centers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("code", unit.costCenterCode)
            .single();

          if (existingCC) {
            costCenters.set(unit.costCenterCode, existingCC.id);
          } else {
            const { data: newCC } = await supabase
              .from("cost_centers")
              .insert({
                tenant_id: tenantId,
                code: unit.costCenterCode,
                name: unit.costCenterName || unit.costCenterCode,
              })
              .select()
              .single();

            if (newCC) {
              costCenters.set(unit.costCenterCode, newCC.id);
            }
          }
        }
      }

      // Insert units
      const unitIdMap = new Map<string, string>();
      for (const unit of structureData.units) {
        const { data: newUnit } = await supabase
          .from("business_units")
          .insert({
            business_structure_id: editingStructure.id,
            name: unit.name,
            level: unit.level,
            position_x: unit.positionX,
            position_y: unit.positionY,
            cost_center_id: unit.costCenterCode
              ? costCenters.get(unit.costCenterCode)
              : null,
          })
          .select()
          .single();

        if (newUnit) {
          unitIdMap.set(unit.id, newUnit.id);
        }
      }

      // Insert relationships
      for (const rel of structureData.relationships) {
        const parentId = unitIdMap.get(rel.parentId);
        const childId = unitIdMap.get(rel.childId);

        if (parentId && childId) {
          await supabase.from("business_unit_relationships").insert({
            business_structure_id: editingStructure.id,
            parent_unit_id: parentId,
            child_unit_id: childId,
          });
        }
      }

      toast.success("Business structure saved successfully");
      setShowEditor(false);
      await loadStructures();
    } catch (error) {
      console.error("Error saving structure:", error);
      toast.error("Failed to save business structure");
      throw error;
    }
  };

  const handleSetActive = async (structureId: string) => {
    try {
      const { error } = await supabase
        .from("business_structures")
        .update({ is_active: true })
        .eq("id", structureId);

      if (error) throw error;

      await loadStructures();
      toast.success("Active structure updated");
    } catch (error) {
      console.error("Error setting active structure:", error);
      toast.error("Failed to set active structure");
    }
  };

  const handleUpdateStructureName = async (name: string) => {
    if (!editingStructure) return;

    try {
      const { error } = await supabase
        .from("business_structures")
        .update({ 
          name,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingStructure.id);

      if (error) throw error;

      setEditingStructure({ ...editingStructure, name });
      await loadStructures();
      toast.success("Structure name updated");
    } catch (error) {
      console.error("Error updating structure name:", error);
      toast.error("Failed to update structure name");
    }
  };

  const handleDeleteStructure = async (structureId: string) => {
    if (!confirm("Are you sure you want to delete this business structure?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("business_structures")
        .delete()
        .eq("id", structureId);

      if (error) throw error;

      await loadStructures();
      toast.success("Business structure deleted");
    } catch (error) {
      console.error("Error deleting structure:", error);
      toast.error("Failed to delete business structure");
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (showEditor && editingStructure) {
    const initialData = (editingStructure as any).units ? {
      units: (editingStructure as any).units || [],
      relationships: (editingStructure as any).relationships || [],
      levels: editingStructure.max_levels || 10,
      levelNames: (editingStructure as any).levelNames || {},
    } : undefined;

    return (
      <BusinessStructureEditor
        structureName={editingStructure.name}
        structureDescription={(editingStructure as any).actualDescription || ""}
        onSave={handleSaveStructure}
        onUpdateName={handleUpdateStructureName}
        onClose={() => setShowEditor(false)}
        initialData={initialData}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Business Structure"
        description="Manage your organizational hierarchy and structure"
      />

      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Define your company's organizational structure, departments, and teams.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-admin hover:bg-admin/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create business structure
          </Button>
        </div>

        {/* Structures List */}
        {structures.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structures.map((structure) => (
              <div
                key={structure.id}
                className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{structure.name}</h3>
                  </div>
                  {structure.is_active && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      Active
                    </span>
                  )}
                </div>

                {(() => {
                  let desc = "";
                  if (structure.description) {
                    try {
                      const parsed = JSON.parse(structure.description);
                      desc = parsed.description || "";
                    } catch (e) {
                      desc = structure.description;
                    }
                  }
                  return desc ? (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{desc}</p>
                  ) : null;
                })()}

                <div className="text-xs text-muted-foreground mb-4">
                  {structure.updated_at && structure.created_at && Math.abs(new Date(structure.updated_at).getTime() - new Date(structure.created_at).getTime()) > 2000 ? (
                    <>
                      Created {new Date(structure.created_at).toLocaleString()}
                      <br />
                      Updated {new Date(structure.updated_at).toLocaleString()}
                    </>
                  ) : structure.created_at ? (
                    <>Created {new Date(structure.created_at).toLocaleString()}</>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditor(structure)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {!structure.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetActive(structure.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Set Active
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteStructure(structure.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg p-12 text-center bg-gray-50">
            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-admin/10 mb-4">
                  <Plus className="h-8 w-8 text-admin" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                No business structure defined yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Get started by creating your first business structure to organize
                your company's hierarchy.
              </p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-admin hover:bg-admin/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create business structure
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              Create New Business Structure
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="structure-name">Structure Name *</Label>
                <Input
                  id="structure-name"
                  value={newStructureName}
                  onChange={(e) => setNewStructureName(e.target.value)}
                  placeholder="e.g., Main Organization Structure"
                />
              </div>
              <div>
                <Label htmlFor="structure-description">Description</Label>
                <Input
                  id="structure-description"
                  value={newStructureDescription}
                  onChange={(e) => setNewStructureDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewStructureName("");
                  setNewStructureDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateStructure}
                className="bg-admin hover:bg-admin/90"
              >
                Create & Edit
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

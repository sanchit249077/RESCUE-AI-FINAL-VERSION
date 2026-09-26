import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge, EmptyState, StatCard } from "@/components/shared";
import DisasterMap from "@/components/DisasterMap";
import { Package, Loader2, MapPin, Plus, Route, Brain } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const resourceTypes = ["rescue_team", "medical_unit", "supplies", "vehicle", "equipment", "shelter", "food_water"];

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [disasters, setDisasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [optimizing, setOptimizing] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [r, d] = await Promise.all([
        base44.entities.Resource.list("-created_date", 100),
        base44.entities.Disaster.list("-created_date", 50),
      ]);
      setResources(r);
      setDisasters(d);
    } finally {
      setLoading(false);
    }
  };

  const available = resources.filter((r) => r.status === "available").length;
  const deployed = resources.filter((r) => r.status === "deployed").length;
  const enRoute = resources.filter((r) => r.status === "en_route").length;

  const optimizeRoute = async (resource, disaster) => {
    setOptimizing(resource.id);
    setRouteResult(null);
    try {
      const prompt = `You are an AI route optimization system for emergency resource deployment. Calculate the optimal deployment plan.

Resource: ${resource.name} (${resource.type})
Current Location: ${resource.location_name} (${resource.latitude}, ${resource.longitude})
Target Disaster: ${disaster.name} at ${disaster.location_name} (${disaster.latitude}, ${disaster.longitude})
Resource Status: ${resource.status}

Respond in JSON:
{
  "estimated_distance_km": number,
  "estimated_travel_time_min": number,
  "recommended_route": "step by step route description",
  "safety_advisory": "route safety notes and hazards to avoid",
  "deployment_priority": "immediate" | "urgent" | "standard",
  "alternative_route": "backup route if primary is blocked"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            estimated_distance_km: { type: "number" },
            estimated_travel_time_min: { type: "number" },
            recommended_route: { type: "string" },
            safety_advisory: { type: "string" },
            deployment_priority: { type: "string" },
            alternative_route: { type: "string" },
          },
        },
      });

      await base44.entities.Resource.update(resource.id, {
        status: "en_route",
        assigned_disaster_id: disaster.id,
        assigned_disaster_name: disaster.name,
      });
      setRouteResult(res);
      toast({ title: "Route optimized", description: `ETA: ${res.estimated_travel_time_min} min, ${res.estimated_distance_km} km` });
      load();
    } finally {
      setOptimizing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Emergency Resource Allocation"
        subtitle="Deploy rescue teams, medical units, and supplies with AI route optimization"
        icon={Package}
        actions={
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800">
            <Plus className="w-4 h-4" /> {showForm ? "Close" : "Add Resource"}
          </button>
        }
      />

      {showForm && <ResourceForm onCreated={() => { setShowForm(false); load(); }} />}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Available" value={available} icon={Package} accent="emerald" />
        <StatCard label="Deployed" value={deployed} icon={Package} accent="red" />
        <StatCard label="En Route" value={enRoute} icon={Route} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-800 mb-2">Resource Inventory</h2>
          {resources.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Package} title="No resources registered" /></Card>
          ) : (
            resources.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{r.type.replace("_", " ")} · {r.quantity} {r.unit || ""}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {r.location_name}</span>
                        {r.assigned_disaster_name && <span className="text-xs text-red-600">→ {r.assigned_disaster_name}</span>}
                      </div>
                      {r.contact_person && <p className="text-xs text-slate-400 mt-1">Contact: {r.contact_person}</p>}
                    </div>
                  </div>
                  <StatusBadge value={r.status} />
                </div>
                {r.status === "available" && disasters.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Deploy to disaster:</p>
                    <div className="flex flex-wrap gap-2">
                      {disasters.filter((d) => d.status === "active" || d.status === "monitoring").slice(0, 4).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => optimizeRoute(r, d)}
                          disabled={optimizing === r.id}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 disabled:opacity-50"
                        >
                          {optimizing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />} {d.name.length > 18 ? d.name.slice(0, 18) + "..." : d.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 h-fit">
            <h2 className="font-semibold text-slate-800 mb-3">Resource Map</h2>
            <DisasterMap resources={resources} disasters={disasters.filter((d) => d.status === "active")} height="350px" showLegend={false} />
          </Card>

          {routeResult && (
            <Card className="p-4 border-2 border-blue-100">
              <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2"><Route className="w-4 h-4 text-blue-500" /> AI Route Plan</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">Distance</p>
                    <p className="font-bold text-slate-800">{routeResult.estimated_distance_km} km</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-xs text-slate-500">ETA</p>
                    <p className="font-bold text-slate-800">{routeResult.estimated_travel_time_min} min</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Recommended Route</p>
                  <p className="text-xs text-slate-700">{routeResult.recommended_route}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Safety Advisory</p>
                  <p className="text-xs text-slate-700 p-2 rounded-lg bg-amber-50">{routeResult.safety_advisory}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Alternative Route</p>
                  <p className="text-xs text-slate-700">{routeResult.alternative_route}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Priority:</span>
                  <StatusBadge value={routeResult.deployment_priority} />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceForm({ onCreated }) {
  const [form, setForm] = useState({ name: "", type: "rescue_team", quantity: "1", unit: "", location_name: "", latitude: "", longitude: "", contact_person: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSaving(true);
    try {
      await base44.entities.Resource.create({
        ...form,
        quantity: parseInt(form.quantity),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        status: "available",
      });
      toast({ title: "Resource added", description: "New resource registered and available for deployment." });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 mb-6 border-2 border-emerald-100">
      <h2 className="font-semibold text-slate-800 mb-4">Register New Resource</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Resource name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm capitalize" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {resourceTypes.map((t) => <option key={t} value={t} className="capitalize">{t.replace("_", " ")}</option>)}
        </select>
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Unit (e.g. personnel, kits)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Location name" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
      </div>
      <button onClick={submit} disabled={saving || !form.name || !form.location_name || !form.latitude} className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Register Resource
      </button>
    </Card>
  );
}
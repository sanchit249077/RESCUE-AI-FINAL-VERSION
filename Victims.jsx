import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge, EmptyState, StatCard } from "@/components/shared";
import DisasterMap from "@/components/DisasterMap";
import { Users, Loader2, Brain, AlertTriangle, CheckCircle, MapPin, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Victims() {
  const [victims, setVictims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prioritizing, setPrioritizing] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadVictims(); }, []);

  const loadVictims = async () => {
    try {
      const data = await base44.entities.VictimReport.list("-created_date", 100);
      setVictims(data);
    } finally {
      setLoading(false);
    }
  };

  const prioritize = async (victim) => {
    setPrioritizing(victim.id);
    try {
      const prompt = `You are an AI rescue prioritization system. Assess this victim report and generate a priority score and rescue recommendation.

Description: ${victim.description}
People: ${victim.people_count}
Location: ${victim.location_name} (${victim.latitude}, ${victim.longitude})
Vulnerability: ${victim.vulnerability}
Current Status: ${victim.status}

Respond in JSON:
{
  "ai_priority": number (0-100, higher = more urgent),
  "ai_recommendation": "specific rescue action and resource recommendation",
  "estimated_urgency": "immediate" | "urgent" | "moderate" | "low"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            ai_priority: { type: "number" },
            ai_recommendation: { type: "string" },
            estimated_urgency: { type: "string" },
          },
        },
      });

      await base44.entities.VictimReport.update(victim.id, {
        ai_priority: res.ai_priority,
        ai_recommendation: res.ai_recommendation,
      });
      toast({ title: "Priority assessed", description: `AI Priority Score: ${res.ai_priority}/100` });
      loadVictims();
    } finally {
      setPrioritizing(null);
    }
  };

  const updateStatus = async (victim, status) => {
    await base44.entities.VictimReport.update(victim.id, { status });
    loadVictims();
  };

  const sorted = [...victims].sort((a, b) => (b.ai_priority || 0) - (a.ai_priority || 0));
  const pending = victims.filter((v) => v.status === "pending").length;
  const inProgress = victims.filter((v) => v.status === "in_progress").length;
  const rescued = victims.filter((v) => v.status === "rescued").length;

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
        title="Victim Detection & Prioritization"
        subtitle="AI-powered rescue prioritization based on vulnerability and severity"
        icon={Users}
        actions={
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800">
            <Plus className="w-4 h-4" /> {showForm ? "Close" : "Report Victim"}
          </button>
        }
      />

      {showForm && <VictimForm onCreated={() => { setShowForm(false); loadVictims(); }} />}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending Rescue" value={pending} icon={AlertTriangle} accent="red" />
        <StatCard label="In Progress" value={inProgress} icon={Loader2} accent="amber" />
        <StatCard label="Rescued" value={rescued} icon={CheckCircle} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-slate-800 mb-2">Priority Queue (sorted by AI urgency)</h2>
          {sorted.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Users} title="No victim reports" /></Card>
          ) : (
            sorted.map((v, idx) => (
              <Card key={v.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white ${
                      (v.ai_priority || 0) >= 75 ? "bg-red-500" : (v.ai_priority || 0) >= 50 ? "bg-amber-500" : (v.ai_priority || 0) > 0 ? "bg-emerald-500" : "bg-slate-300"
                    }`}>
                      {v.people_count}
                    </div>
                    {v.ai_priority && <span className="text-[10px] font-bold text-slate-400 mt-1">P:{v.ai_priority}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{v.location_name}</p>
                        <p className="text-sm text-slate-500 mt-0.5">{v.description}</p>
                      </div>
                      <StatusBadge value={v.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge value={v.vulnerability} />
                      <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {v.latitude?.toFixed(2)}, {v.longitude?.toFixed(2)}</span>
                    </div>
                    {v.ai_recommendation && (
                      <p className="text-xs text-slate-600 mt-2 p-2 rounded-lg bg-violet-50 border border-violet-100">
                        <span className="font-semibold text-violet-700">AI:</span> {v.ai_recommendation}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {!v.ai_priority && (
                        <button onClick={() => prioritize(v)} disabled={prioritizing === v.id} className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-violet-100 disabled:opacity-50">
                          {prioritizing === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />} AI Prioritize
                        </button>
                      )}
                      {v.status === "pending" && (
                        <button onClick={() => updateStatus(v, "in_progress")} className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100">Start Rescue</button>
                      )}
                      {v.status === "in_progress" && (
                        <button onClick={() => updateStatus(v, "rescued")} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100">Mark Rescued</button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="p-4 h-fit sticky top-24">
          <h2 className="font-semibold text-slate-800 mb-3">Victim Locations</h2>
          <DisasterMap victims={victims} height="400px" showLegend={false} />
        </Card>
      </div>
    </div>
  );
}

function VictimForm({ onCreated }) {
  const [form, setForm] = useState({ description: "", location_name: "", latitude: "", longitude: "", people_count: "1", vulnerability: "moderate", reporter_name: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSaving(true);
    try {
      await base44.entities.VictimReport.create({
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        people_count: parseInt(form.people_count),
        status: "pending",
      });
      toast({ title: "Victim report filed", description: "AI will assess priority shortly." });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 mb-6 border-2 border-red-100">
      <h2 className="font-semibold text-slate-800 mb-4">Report Stranded Victims</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <textarea className="px-3 py-2 rounded-lg border border-slate-200 text-sm sm:col-span-2 min-h-[80px]" placeholder="Describe the situation (people stranded, conditions, urgency)..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Location name" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" type="number" placeholder="People count" value={form.people_count} onChange={(e) => setForm({ ...form, people_count: e.target.value })} />
        <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm capitalize" value={form.vulnerability} onChange={(e) => setForm({ ...form, vulnerability: e.target.value })}>
          {["low", "moderate", "high", "critical"].map((v) => <option key={v} value={v} className="capitalize">{v}</option>)}
        </select>
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Reporter name" value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} />
      </div>
      <button onClick={submit} disabled={saving || !form.description || !form.location_name || !form.latitude} className="mt-4 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Submit Report
      </button>
    </Card>
  );
}
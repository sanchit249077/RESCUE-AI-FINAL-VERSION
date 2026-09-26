import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/shared";
import DisasterMap from "@/components/DisasterMap";
import { Radio, Loader2, MapPin, CheckCircle, XCircle, Plus, Image as ImageIcon, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const incidentTypes = ["flood", "landslide", "earthquake", "cyclone", "wildfire", "infrastructure_damage", "road_blockage", "stranded_people", "other"];

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verifying, setVerifying] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadIncidents(); }, []);

  const loadIncidents = async () => {
    try {
      const data = await base44.entities.IncidentReport.list("-created_date", 100);
      setIncidents(data);
    } finally {
      setLoading(false);
    }
  };

  const verifyIncident = async (incident) => {
    setVerifying(incident.id);
    try {
      const prompt = `You are an AI incident verification system for disaster response. Analyze this crowdsourced incident report and assess its authenticity and severity.

Title: ${incident.title}
Description: ${incident.description}
Type: ${incident.type}
Location: ${incident.location_name} (${incident.latitude}, ${incident.longitude})
Reporter: ${incident.reporter_name || "Anonymous"}

Respond in JSON:
{
  "is_authentic": boolean,
  "confidence_percent": number,
  "assessed_severity": "low" | "moderate" | "high" | "critical",
  "verification_notes": "explanation",
  "recommended_status": "verified" | "rejected"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            is_authentic: { type: "boolean" },
            confidence_percent: { type: "number" },
            assessed_severity: { type: "string" },
            verification_notes: { type: "string" },
            recommended_status: { type: "string" },
          },
        },
      });

      await base44.entities.IncidentReport.update(incident.id, {
        status: res.recommended_status,
        severity: res.assessed_severity,
        ai_verification: `${res.verification_notes} (Confidence: ${res.confidence_percent}%)`,
      });
      toast({ title: "Incident verified by AI", description: `Status: ${res.recommended_status}, Confidence: ${res.confidence_percent}%` });
      loadIncidents();
    } finally {
      setVerifying(null);
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
        title="Crowdsourced Incident Reporting"
        subtitle="Citizen reports with AI-based authenticity verification"
        icon={Radio}
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> {showForm ? "Close" : "New Report"}
          </button>
        }
      />

      {showForm && <ReportForm onCreated={() => { setShowForm(false); loadIncidents(); }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold text-slate-800">All Reports</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">{incidents.length}</span>
          </div>
          {incidents.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Radio} title="No incident reports yet" subtitle="Citizen reports will appear here for verification." /></Card>
          ) : (
            incidents.map((i) => (
              <Card key={i.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {i.image_url ? (
                    <img src={i.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{i.title}</p>
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{i.description}</p>
                      </div>
                      <StatusBadge value={i.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {i.location_name}</span>
                      <span className="capitalize">{i.type.replace("_", " ")}</span>
                      <StatusBadge value={i.severity} />
                    </div>
                    {i.ai_verification && (
                      <p className="text-xs text-slate-500 mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="font-semibold text-slate-600">AI:</span> {i.ai_verification}
                      </p>
                    )}
                    {i.status === "pending" && (
                      <button
                        onClick={() => verifyIncident(i)}
                        disabled={verifying === i.id}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold flex items-center gap-1.5 hover:bg-violet-100 disabled:opacity-50"
                      >
                        {verifying === i.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Verifying...</> : <><CheckCircle className="w-3 h-3" /> AI Verify</>}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="p-4 h-fit sticky top-24">
          <h2 className="font-semibold text-slate-800 mb-3">Incident Map</h2>
          <DisasterMap incidents={incidents} height="400px" showLegend={false} />
        </Card>
      </div>
    </div>
  );
}

function ReportForm({ onCreated }) {
  const [form, setForm] = useState({
    title: "", description: "", type: "flood", location_name: "", latitude: "", longitude: "", reporter_name: "", reporter_contact: "",
  });
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSaving(true);
    try {
      let image_url = "";
      if (image) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: image });
        image_url = file_url;
      }
      await base44.entities.IncidentReport.create({
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        image_url,
        status: "pending",
      });
      toast({ title: "Report submitted", description: "Your incident report has been received for verification." });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 mb-6 border-2 border-red-100">
      <h2 className="font-semibold text-slate-800 mb-4">Submit New Incident Report</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm sm:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="px-3 py-2 rounded-lg border border-slate-200 text-sm sm:col-span-2 min-h-[80px]" placeholder="Describe the incident..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="px-3 py-2 rounded-lg border border-slate-200 text-sm capitalize" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {incidentTypes.map((t) => <option key={t} value={t} className="capitalize">{t.replace("_", " ")}</option>)}
        </select>
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Location name" value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Your name" value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} />
        <input className="px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Contact (phone/email)" value={form.reporter_contact} onChange={(e) => setForm({ ...form, reporter_contact: e.target.value })} />
        <label className="sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 text-sm text-slate-500">
          <Upload className="w-4 h-4" /> {image ? image.name : "Upload image (optional)"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files[0])} />
        </label>
      </div>
      <button
        onClick={submit}
        disabled={saving || !form.title || !form.description || !form.location_name || !form.latitude}
        className="mt-4 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Submit Report
      </button>
    </Card>
  );
}
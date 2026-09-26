import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge } from "@/components/shared";
import { AlertTriangle, Loader2, Upload, Image as ImageIcon, Brain, Building2, Route as Road, Users } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useToast } from "@/components/ui/use-toast";

export default function DamageAssessment() {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyze = async () => {
    if (!imageUrl) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const prompt = `You are an AI computer vision system analyzing satellite/drone imagery of a disaster-affected area. Assess the damage visible in this image.

Respond in JSON:
{
  "damage_percentage": number (0-100),
  "damaged_buildings": number,
  "blocked_roads": number,
  "affected_population_estimate": number,
  "infrastructure_status": "intact" | "minor_damage" | "moderate_damage" | "severe_damage" | "destroyed",
  "accessible_routes": "description of passable routes",
  "blocked_areas": "description of blocked or inaccessible areas",
  "priority_targets": ["area1", "area2"],
  "relief_recommendation": "immediate relief action plan",
  "confidence_level": number (0-100)
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            damage_percentage: { type: "number" },
            damaged_buildings: { type: "number" },
            blocked_roads: { type: "number" },
            affected_population_estimate: { type: "number" },
            infrastructure_status: { type: "string" },
            accessible_routes: { type: "string" },
            blocked_areas: { type: "string" },
            priority_targets: { type: "array", items: { type: "string" } },
            relief_recommendation: { type: "string" },
            confidence_level: { type: "number" },
          },
        },
      });
      setAnalysis(res);
      toast({ title: "Damage assessment complete", description: `${res.damage_percentage}% damage detected` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    setImage(file);
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI-Based Damage Assessment"
        subtitle="Computer vision analysis of satellite & drone imagery for damage detection"
        icon={AlertTriangle}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" /> Upload Imagery
          </h2>

          {!imageUrl ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl py-16 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">Upload satellite or drone image</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG up to 10MB</p>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                <Image src={imageUrl} alt="Uploaded imagery" className="w-full max-h-[300px] object-cover" />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={analyze}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing imagery...</> : <><Brain className="w-4 h-4" /> Run AI Damage Analysis</>}
                </button>
                <label className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-200">
                  Replace
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} />
                </label>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What AI Detects</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center text-center">
                <Building2 className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Damaged Buildings</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Road className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Blocked Roads</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Users className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-xs text-slate-500">Affected People</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-red-500" /> Assessment Results
          </h2>

          {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Upload imagery and run analysis to see damage assessment.</p>
            </div>
          )}

          {loading && !analysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Running computer vision analysis...</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                <div>
                  <p className="text-xs text-slate-300 uppercase tracking-wider">Overall Damage</p>
                  <p className="text-4xl font-bold mt-1">{analysis.damage_percentage}<span className="text-lg text-slate-400">%</span></p>
                </div>
                <div className="text-right">
                  <StatusBadge value={analysis.infrastructure_status} />
                  <p className="text-xs text-slate-300 mt-2">Confidence: {analysis.confidence_level}%</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 text-center">
                  <Building2 className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-slate-800">{analysis.damaged_buildings}</p>
                  <p className="text-xs text-slate-500">Buildings</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 text-center">
                  <Road className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-slate-800">{analysis.blocked_roads}</p>
                  <p className="text-xs text-slate-500">Roads</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 text-center">
                  <Users className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-slate-800">{(analysis.affected_population_estimate || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">People</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Accessible Routes</p>
                <p className="text-sm text-slate-700 p-3 rounded-xl bg-emerald-50 border border-emerald-100">{analysis.accessible_routes}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Blocked Areas</p>
                <p className="text-sm text-slate-700 p-3 rounded-xl bg-red-50 border border-red-100">{analysis.blocked_areas}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority Targets</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.priority_targets?.map((t, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-100">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Relief Recommendation</p>
                <p className="text-sm text-slate-700 p-3 rounded-xl bg-blue-50 border border-blue-100">{analysis.relief_recommendation}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
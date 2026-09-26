import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge, StatCard } from "@/components/shared";
import { BarChart3, Loader2, Brain, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";

const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"];

export default function Analytics() {
  const [disasters, setDisasters] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [victims, setVictims] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [d, i, r, v] = await Promise.all([
        base44.entities.Disaster.list("-created_date", 50),
        base44.entities.IncidentReport.list("-created_date", 100),
        base44.entities.Resource.list("-created_date", 100),
        base44.entities.VictimReport.list("-created_date", 100),
      ]);
      setDisasters(d);
      setIncidents(i);
      setResources(r);
      setVictims(v);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    setGenerating(true);
    setInsights(null);
    try {
      const prompt = `You are an AI disaster analytics and decision support system. Analyze the following disaster response data and provide actionable insights for authorities.

Active Disasters: ${disasters.length}
Disaster Types: ${disasters.map((d) => `${d.type} (${d.severity}, risk ${d.risk_score})`).join(", ")}
Total Affected Population: ${disasters.reduce((s, d) => s + (d.affected_population || 0), 0)}
Incident Reports: ${incidents.length} (${incidents.filter((i) => i.status === "verified").length} verified)
Resources: ${resources.length} (${resources.filter((r) => r.status === "available").length} available, ${resources.filter((r) => r.status === "deployed").length} deployed)
Victim Reports: ${victims.length} (${victims.filter((v) => v.status === "rescued").length} rescued)

Respond in JSON:
{
  "situation_summary": "overall situation assessment",
  "spread_prediction": "prediction of how disasters may spread",
  "impact_zones": ["zone1", "zone2", "zone3"],
  "resource_gaps": ["gap1", "gap2"],
  "priority_recommendations": ["rec1", "rec2", "rec3", "rec4"],
  "risk_trend": "improving" | "stable" | "worsening",
  "estimated_response_time_reduction": "description of efficiency gains"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            situation_summary: { type: "string" },
            spread_prediction: { type: "string" },
            impact_zones: { type: "array", items: { type: "string" } },
            resource_gaps: { type: "array", items: { type: "string" } },
            priority_recommendations: { type: "array", items: { type: "string" } },
            risk_trend: { type: "string" },
            estimated_response_time_reduction: { type: "string" },
          },
        },
      });
      setInsights(res);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const typeData = ["flood", "landslide", "earthquake", "cyclone", "wildfire"].map((type) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count: disasters.filter((d) => d.type === type).length,
  })).filter((t) => t.count > 0);

  const severityData = ["low", "moderate", "high", "critical"].map((sev) => ({
    name: sev,
    value: disasters.filter((d) => d.severity === sev).length,
  })).filter((s) => s.value > 0);

  const statusData = ["monitoring", "active", "contained", "resolved"].map((st) => ({
    name: st,
    count: disasters.filter((d) => d.status === st).length,
  }));

  const resourceStatusData = [
    { name: "Available", value: resources.filter((r) => r.status === "available").length, fill: "#10b981" },
    { name: "Deployed", value: resources.filter((r) => r.status === "deployed").length, fill: "#ef4444" },
    { name: "En Route", value: resources.filter((r) => r.status === "en_route").length, fill: "#f59e0b" },
  ].filter((r) => r.value > 0);

  const totalAffected = disasters.reduce((s, d) => s + (d.affected_population || 0), 0);
  const avgRisk = disasters.length ? Math.round(disasters.reduce((s, d) => s + (d.risk_score || 0), 0) / disasters.length) : 0;
  const rescueRate = victims.length ? Math.round((victims.filter((v) => v.status === "rescued").length / victims.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Analytics & Decision Support"
        subtitle="Predict disaster spread, impact zones, and generate actionable insights"
        icon={BarChart3}
        actions={
          <button
            onClick={generateInsights}
            disabled={generating}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 hover:shadow-lg"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />} Generate AI Insights
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Disasters" value={disasters.length} icon={AlertTriangle} accent="red" />
        <StatCard label="People Affected" value={totalAffected.toLocaleString()} icon={TrendingUp} accent="amber" />
        <StatCard label="Avg Risk Score" value={avgRisk} icon={BarChart3} accent="violet" />
        <StatCard label="Rescue Rate" value={`${rescueRate}%`} icon={Brain} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Disasters by Type</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="type" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Severity Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                {severityData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Legend />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Disaster Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#64748b" }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Resource Deployment</h2>
          <ResponsiveContainer width="100%" height={250}>
            <RadialBarChart data={resourceStatusData} innerRadius="30%" outerRadius="100%" startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={8} />
              <Legend iconType="circle" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {insights && (
        <Card className="p-6 border-2 border-violet-100">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" /> AI-Generated Decision Support Report
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Situation Summary</p>
                <p className="text-sm text-slate-700">{insights.situation_summary}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Spread Prediction</p>
                <p className="text-sm text-slate-700">{insights.spread_prediction}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Trend:</span>
              <StatusBadge value={insights.risk_trend} />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-4">Response Time:</span>
              <span className="text-sm text-slate-700">{insights.estimated_response_time_reduction}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Impact Zones</p>
                <div className="space-y-1.5">
                  {insights.impact_zones?.map((z, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {z}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resource Gaps</p>
                <div className="space-y-1.5">
                  {insights.resource_gaps?.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> {g}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority Recommendations</p>
              <div className="space-y-2">
                {insights.priority_recommendations?.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 border border-violet-100">
                    <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-slate-700">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {!insights && !generating && (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-violet-500" />
          </div>
          <p className="text-sm text-slate-500">Click "Generate AI Insights" to produce a decision support report with spread predictions and recommendations.</p>
        </Card>
      )}
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge } from "@/components/shared";
import { Brain, Loader2, AlertTriangle, TrendingUp, Zap } from "lucide-react";

const disasterTypes = ["flood", "landslide", "earthquake", "cyclone", "wildfire"];

export default function Predictions() {
  const [form, setForm] = useState({
    type: "flood",
    location_name: "",
    latitude: "",
    longitude: "",
    rainfall_mm: "",
    wind_speed_kmh: "",
    soil_moisture: "",
    seismic_activity: "",
    temperature_c: "",
    historical_incidents: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const predict = async () => {
    setLoading(true);
    setResult(null);
    try {
      const prompt = `You are an AI disaster prediction model. Analyze the following environmental parameters and predict disaster risk.

Disaster Type: ${form.type}
Location: ${form.location_name}
Coordinates: ${form.latitude}, ${form.longitude}
Rainfall (mm): ${form.rainfall_mm || "N/A"}
Wind Speed (km/h): ${form.wind_speed_kmh || "N/A"}
Soil Moisture (%): ${form.soil_moisture || "N/A"}
Seismic Activity: ${form.seismic_activity || "N/A"}
Temperature (°C): ${form.temperature_c || "N/A"}
Historical Incidents in Region: ${form.historical_incidents || "N/A"}

Respond in JSON with this exact schema:
{
  "risk_score": number (0-100),
  "severity": "low" | "moderate" | "high" | "critical",
  "probability_percent": number,
  "predicted_impact": "short description of expected impact",
  "early_warning": "specific early warning message",
  "recommended_actions": ["action1", "action2", "action3"],
  "risk_factors": ["factor1", "factor2", "factor3"],
  "evacuation_recommended": boolean,
  "time_horizon": "estimated time until impact"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            risk_score: { type: "number" },
            severity: { type: "string" },
            probability_percent: { type: "number" },
            predicted_impact: { type: "string" },
            early_warning: { type: "string" },
            recommended_actions: { type: "array", items: { type: "string" } },
            risk_factors: { type: "array", items: { type: "string" } },
            evacuation_recommended: { type: "boolean" },
            time_horizon: { type: "string" },
          },
        },
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Disaster Prediction Module"
        subtitle="AI-powered risk analysis using environmental data and ML models"
        icon={Brain}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Environmental Input Parameters
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Disaster Type</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                {disasterTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`px-2 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      form.type === t
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Location Name" name="location_name" value={form.location_name} onChange={handleChange} placeholder="e.g. Mumbai, Maharashtra" />
              <Field label="Latitude" name="latitude" value={form.latitude} onChange={handleChange} placeholder="19.076" />
              <Field label="Longitude" name="longitude" value={form.longitude} onChange={handleChange} placeholder="72.8777" />
              <Field label="Rainfall (mm)" name="rainfall_mm" value={form.rainfall_mm} onChange={handleChange} placeholder="320" />
              <Field label="Wind Speed (km/h)" name="wind_speed_kmh" value={form.wind_speed_kmh} onChange={handleChange} placeholder="45" />
              <Field label="Soil Moisture (%)" name="soil_moisture" value={form.soil_moisture} onChange={handleChange} placeholder="75" />
              <Field label="Seismic Activity" name="seismic_activity" value={form.seismic_activity} onChange={handleChange} placeholder="2.1 magnitude" />
              <Field label="Temperature (°C)" name="temperature_c" value={form.temperature_c} onChange={handleChange} placeholder="34" />
            </div>

            <Field label="Historical Incidents in Region" name="historical_incidents" value={form.historical_incidents} onChange={handleChange} placeholder="3 major floods in last decade" full />

            <button
              onClick={predict}
              disabled={loading || !form.location_name}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/30 transition-all"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running ML Prediction...</> : <><Brain className="w-4 h-4" /> Generate Risk Prediction</>}
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-500" /> Prediction Results
          </h2>
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Enter environmental parameters and run prediction to see AI risk analysis.</p>
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Analyzing data with ML models...</p>
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                <div>
                  <p className="text-xs text-slate-300 uppercase tracking-wider">Risk Score</p>
                  <p className="text-4xl font-bold mt-1">{result.risk_score}<span className="text-lg text-slate-400">/100</span></p>
                </div>
                <div className="text-right">
                  <StatusBadge value={result.severity} />
                  <p className="text-xs text-slate-300 mt-2">{result.probability_percent}% probability</p>
                </div>
              </div>

              {result.evacuation_recommended && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Evacuation Recommended</span>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Predicted Impact</p>
                <p className="text-sm text-slate-700">{result.predicted_impact}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Time Horizon</p>
                <p className="text-sm text-slate-700">{result.time_horizon}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Early Warning</p>
                <p className="text-sm text-slate-700 p-3 rounded-xl bg-amber-50 border border-amber-200">{result.early_warning}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Risk Factors</p>
                <div className="flex flex-wrap gap-2">
                  {result.risk_factors?.map((f, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs text-slate-700">{f}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                <div className="space-y-2">
                  {result.recommended_actions?.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, placeholder, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
      />
    </div>
  );
}
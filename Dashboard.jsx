import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, StatCard, StatusBadge, Card, EmptyState } from "@/components/shared";
import DisasterMap from "@/components/DisasterMap";
import { LayoutDashboard, AlertTriangle, Users, Package, Activity, TrendingUp, Radio } from "lucide-react";

export default function Dashboard() {
  const [disasters, setDisasters] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [resources, setResources] = useState([]);
  const [victims, setVictims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [d, i, r, v] = await Promise.all([
        base44.entities.Disaster.list("-created_date", 50),
        base44.entities.IncidentReport.list("-created_date", 50),
        base44.entities.Resource.list("-created_date", 50),
        base44.entities.VictimReport.list("-created_date", 50),
      ]);
      setDisasters(d);
      setIncidents(i);
      setResources(r);
      setVictims(v);
    } finally {
      setLoading(false);
    }
  };

  const activeDisasters = disasters.filter((d) => d.status === "active");
  const totalAffected = disasters.reduce((sum, d) => sum + (d.affected_population || 0), 0);
  const pendingIncidents = incidents.filter((i) => i.status === "pending").length;
  const deployedResources = resources.filter((r) => r.status === "deployed" || r.status === "en_route").length;

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
        title="Real-Time Monitoring Dashboard"
        subtitle="Live disaster tracking, GIS mapping, and situational awareness"
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Disasters" value={activeDisasters.length} icon={AlertTriangle} accent="red" trend="Requiring immediate response" />
        <StatCard label="People Affected" value={totalAffected.toLocaleString()} icon={Users} accent="amber" trend="Across all active zones" />
        <StatCard label="Pending Incidents" value={pendingIncidents} icon={Radio} accent="violet" trend="Awaiting AI verification" />
        <StatCard label="Deployed Resources" value={deployedResources} icon={Package} accent="blue" trend="Teams & units in field" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">Live Disaster Map</h2>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Activity className="w-3.5 h-3.5 text-emerald-500" /> Real-time
              </span>
            </div>
            <DisasterMap disasters={disasters} incidents={incidents} resources={resources} victims={victims} height="480px" />
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Active Disasters</h2>
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {disasters.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No disasters tracked" />
            ) : (
              disasters.map((d) => (
                <div key={d.id} className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.location_name}</p>
                    </div>
                    <StatusBadge value={d.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 capitalize">{d.type}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={d.severity} />
                      <span className="text-slate-400">Risk: {d.risk_score || "—"}</span>
                    </div>
                  </div>
                  {d.risk_score && (
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${d.risk_score >= 75 ? "bg-red-500" : d.risk_score >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${d.risk_score}%` }}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Incident Reports</h2>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {incidents.slice(0, 4).map((i) => (
              <div key={i.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{i.title}</p>
                  <p className="text-xs text-slate-500 truncate">{i.location_name}</p>
                </div>
                <StatusBadge value={i.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Victim Rescue Priority</h2>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            {victims.slice(0, 4).map((v) => (
              <div key={v.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-sm font-bold text-slate-700">
                  {v.people_count}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{v.location_name}</p>
                  <p className="text-xs text-slate-500 truncate">{v.description}</p>
                </div>
                <StatusBadge value={v.vulnerability} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
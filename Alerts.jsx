import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, StatusBadge, EmptyState, StatCard } from "@/components/shared";
import { Siren, Loader2, Send, Mail, MessageSquare, Smartphone, Globe, Languages } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const languages = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
];

const channelIcons = { sms: Smartphone, email: Mail, app: MessageSquare, web: Globe };

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "", message: "", priority: "warning", channels: ["sms", "app"], language: "en", region: "", recipient_count: "",
  });

  useEffect(() => { loadAlerts(); }, []);

  const loadAlerts = async () => {
    try {
      const data = await base44.entities.Alert.list("-created_date", 100);
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (ch) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  };

  const translateAndSend = async () => {
    setSending(true);
    try {
      const langLabel = languages.find((l) => l.code === form.language)?.label || "English";
      let finalMessage = form.message;

      if (form.language !== "en") {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Translate this emergency alert message to ${langLabel}. Keep it clear, urgent, and simple. Return only the translated message:\n\n${form.message}`,
        });
        finalMessage = res;
      }

      const alert = await base44.entities.Alert.create({
        title: form.title,
        message: finalMessage,
        priority: form.priority,
        channels: form.channels.join(","),
        language: form.language,
        region: form.region,
        status: "sent",
        recipient_count: parseInt(form.recipient_count) || 0,
      });

      if (form.channels.includes("email")) {
        await base44.integrations.Core.SendEmail({
          to: "alerts@rescueai.gov",
          subject: `[${form.priority.toUpperCase()}] ${form.title}`,
          body: finalMessage,
        });
      }

      toast({ title: "Alert sent", description: `Multi-channel alert dispatched to ${form.region}` });
      setForm({ title: "", message: "", priority: "warning", channels: ["sms", "app"], language: "en", region: "", recipient_count: "" });
      loadAlerts();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const sentCount = alerts.filter((a) => a.status === "sent").length;
  const criticalCount = alerts.filter((a) => a.priority === "critical" || a.priority === "evacuation").length;
  const totalRecipients = alerts.reduce((s, a) => s + (a.recipient_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="Multi-Channel Alert System"
        subtitle="Send evacuation warnings and safety instructions across SMS, email, app, and web"
        icon={Siren}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Alerts Sent" value={sentCount} icon={Send} accent="blue" />
        <StatCard label="Critical Alerts" value={criticalCount} icon={Siren} accent="red" />
        <StatCard label="Recipients Reached" value={totalRecipients.toLocaleString()} icon={Smartphone} accent="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Compose New Alert</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Alert Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Evacuation Order - Coastal Mumbai" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Message</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Alert message and safety instructions..." className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="evacuation">Evacuation</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Language</label>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Target Region</label>
                <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Mumbai Coastal Zone" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recipient Count</label>
                <input value={form.recipient_count} onChange={(e) => setForm({ ...form, recipient_count: e.target.value })} type="number" placeholder="45000" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Channels</label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {Object.entries(channelIcons).map(([ch, Icon]) => (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium uppercase transition-all ${
                      form.channels.includes(ch)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {form.language !== "en" && (
              <div className="flex items-center gap-2 text-xs text-violet-600 p-2 rounded-lg bg-violet-50">
                <Languages className="w-3.5 h-3.5" /> Message will be auto-translated to {languages.find((l) => l.code === form.language)?.label}
              </div>
            )}

            <button
              onClick={translateAndSend}
              disabled={sending || !form.title || !form.message || !form.region || form.channels.length === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/30 transition-all"
            >
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending alert...</> : <><Send className="w-4 h-4" /> Dispatch Alert</>}
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Alert History</h2>
          {alerts.length === 0 ? (
            <EmptyState icon={Siren} title="No alerts sent yet" />
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {alerts.map((a) => (
                <div key={a.id} className="p-4 rounded-xl border border-slate-200 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm text-slate-800">{a.title}</p>
                    <StatusBadge value={a.priority} />
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{a.message}</p>
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge value={a.status} />
                      <span className="text-xs text-slate-400">{a.region}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {a.channels?.split(",").map((ch) => {
                        const Icon = channelIcons[ch.trim()];
                        return Icon ? <Icon key={ch} className="w-3.5 h-3.5 text-slate-400" /> : null;
                      })}
                      <span className="text-xs text-slate-400 ml-1">{(a.recipient_count || 0).toLocaleString()} recipients</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
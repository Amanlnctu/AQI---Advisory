import React, { useState, useEffect } from 'react';
import { 
  MapPin, Bell, CloudRain, AlertTriangle, ChevronRight, Activity, 
  ChevronLeft, X, Layers, ShieldPlus, Check, Info, Smile, Frown, ShieldAlert
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

import { cn } from './utils'; // Assuming utils exists, or you define it locally

const USER_ID = "test-user-123";
const DEFAULT_LAT = 28.61;
const DEFAULT_LON = 77.23;
const BASE_URL = "http://localhost:8000/api/v1";

// --- Tab: Home Dashboard ---
function HomeTab({ dashboardData, navigateTo }) {
  if (!dashboardData) return <div className="p-8 text-center text-slate-500 animate-pulse mt-20">Loading Dashboard...</div>;

  const { location, current_conditions, tomorrow_prediction, personalized_advisory, trend_24h } = dashboardData;
  const isAlert = personalized_advisory?.is_alert;

  return (
    <div className="flex flex-col gap-5 px-5 pt-8 pb-20 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-green-100 p-2 rounded-full mt-1">
            <MapPin className="w-5 h-5 text-green-500" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Current Location</div>
            <div className="font-extrabold text-[#1f2937] leading-tight">Connaught Place, <br/>New Delhi</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative border border-slate-200 p-2 rounded-full cursor-pointer hover:bg-slate-50">
            <Bell className="w-5 h-5 text-slate-600" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
          </div>
          <div className="w-10 h-10 rounded-full bg-orange-200 overflow-hidden border border-slate-200">
            {/* Mock Avatar */}
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=ffdfbf" alt="avatar" />
          </div>
        </div>
      </div>

      {/* Main Dark AQI Card */}
      <div className="bg-[#1a1f33] rounded-[24px] p-6 text-white relative overflow-hidden shadow-lg mt-2">
        {/* Background Decorative Cloud */}
        <CloudRain className="absolute -right-8 -bottom-4 w-40 h-40 text-white/5" />
        
        <div className="text-sm text-slate-300 font-medium mb-1">Tomorrow's Prediction</div>
        <div className="flex items-baseline gap-2 mb-4">
          <div className="text-4xl font-black">AQI: {tomorrow_prediction?.aqi || '310'}</div>
          <div className="text-xl font-bold text-red-500">- {tomorrow_prediction?.category || 'Severe'}</div>
        </div>
        
        <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
          <span className="text-sm font-semibold">Current AQI: <span className="text-orange-300">{current_conditions?.aqi || '185'}</span></span>
          <span className="text-[10px] bg-slate-600 px-2 py-0.5 rounded-sm uppercase tracking-wider font-bold">Poor</span>
        </div>
      </div>

      {/* Smog Alert Box */}
      {isAlert && (
        <div className="bg-[#fff1f2] rounded-3xl p-5 border border-red-100 relative shadow-sm">
          <div className="flex gap-4">
            <div className="bg-red-500 h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-red-500/20">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight mb-2">
                Severe smog expected at<br/>8 AM tomorrow
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Based on your <span className="font-bold text-slate-800">Asthma</span> profile, avoid outdoor commuting and wear an N95 mask.
              </p>
            </div>
          </div>
          <button className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
            View Health Tips
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 24h Trend Chart */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="font-extrabold text-slate-900 text-lg">24h Pollution Trend</h3>
          <span className="text-xs font-bold text-slate-400">Next 24 Hours</span>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend_24h || []} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="time" 
                tickFormatter={(timeStr) => {
                  const d = new Date(timeStr);
                  // Approximate to match mockup format ("8PM", "12AM")
                  let h = d.getHours();
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  h = h % 12; h = h ? h : 12; 
                  return `${h}${ampm}`;
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                interval={3} // Show fewer ticks to match mockup spacing
                dy={10}
              />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="aqi" radius={[4, 4, 0, 0]} maxBarSize={30}>
                {trend_24h?.map((entry, index) => {
                  // Color highest bars red, mid orange, low generic to match mockup styling
                  let color = "#fb923c"; // base orange
                  if(entry.aqi > 250) color = "#ef4444"; // red peak
                  if(entry.aqi < 150) color = "#fcd34d"; // low yellow
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Promo Route Planner Banner */}
      <div 
        onClick={() => navigateTo('map')}
        className="mt-2 rounded-3xl overflow-hidden relative h-36 border shadow-sm cursor-pointer group"
      >
        <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=New+Delhi&zoom=11&size=600x300&maptype=roadmap&style=element:labels|visibility:off&style=feature:administrative.land_parcel|visibility:off&style=feature:administrative.neighborhood|visibility:off&client=gme-dummy')] bg-cover bg-center brightness-90 grayscale-[0.3]"></div>
        <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/50 transition-colors"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
          <MapPin className="w-8 h-8 mb-1" />
          <h3 className="font-bold text-lg">Safe-Route Planner</h3>
          <p className="text-xs font-medium text-white/80 mt-1">Find the cleanest air route for your commute</p>
        </div>
      </div>

    </div>
  );
}

// --- Tab: Map Routing ---
function MapTab() {
  const [routes, setRoutes] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto calculate for mockup fidelity immediately when opening screen
    calculateRoute();
  }, []);

  const calculateRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/routes/safe-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin_lat: DEFAULT_LAT, origin_lon: DEFAULT_LON, dest_lat: 28.53, dest_lon: 77.30 })
      });
      const data = await res.json();
      setRoutes(data.routes);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fast = routes?.find(r => r.route_type.toLowerCase().includes("fast"));
  const clean = routes?.find(r => r.route_type.toLowerCase().includes("clean"));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in slide-in-from-right-8 duration-300">
      
      {/* Search Header */}
      <div className="bg-white px-5 pt-8 pb-4 rounded-b-[24px] shadow-sm z-10">
        <div className="flex items-center gap-3 mb-6">
          <ChevronLeft className="w-6 h-6 text-slate-800 cursor-pointer" />
          <h2 className="text-lg font-extrabold text-slate-900">Safe Route Explorer</h2>
        </div>

        <div className="relative flex flex-col gap-3">
          {/* Vertical dash line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-[2px] border-l-2 border-dashed border-slate-200"></div>

          {/* Location 1 */}
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl flex items-center p-3 z-10">
            <MapPin className="w-5 h-5 text-green-500 mr-3 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 flex-1 truncate">My Location (Indiranagar, BLR)</span>
            <X className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          {/* Location 2 */}
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl flex items-center p-3 z-10">
            <div className="w-5 h-5 flex items-center justify-center mr-3 shrink-0"><div className="w-3 h-3 bg-green-500 rounded-sm rotate-45"></div></div>
            <span className="text-sm font-semibold text-slate-700 flex-1 truncate">Office (Tech Park, Whitefield)</span>
            <X className="w-4 h-4 text-slate-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Map Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold animate-pulse">Routing Map...</div>
      ) : (
        <div className="flex-1 relative overflow-hidden bg-[#e2e8f0]">
          {/* Mock Map Background Layer */}
          <div className="absolute inset-0 opacity-80" style={{
            backgroundImage: "url('data:image/svg+xml,%3Csvg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'none\\' fill-rule=\\'evenodd\\'%3E%3Cg fill=\\'%23cbd5e1\\' fill-opacity=\\'0.4\\'%3E%3Cpath d=\\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
          }}></div>

          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-[3px] border-dashed border-red-400 rounded-full opacity-30"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-green-500 rounded-bl-full rounded-tr-xl opacity-90 shadow-lg shadow-green-500/20"></div>

          {/* Cleanest Route Card Overlay */}
          <div className="absolute top-[40%] left-[10%] bg-[#22c55e]/90 backdrop-blur-md rounded-2xl p-3 border border-green-400 text-white shadow-xl shadow-green-500/30 max-w-[160px]">
            <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1 opacity-90">Cleanest Route</div>
            <div className="text-xl font-black mb-1 leading-none">{clean?.duration_mins || '18'} mins</div>
            <div className="flex items-center gap-1 text-xs font-semibold bg-black/10 px-2 py-1 rounded-full mb-1">
              <ShieldCheck className="w-3 h-3" /> AQI {clean?.avg_aqi || '120'} (Moderate)
            </div>
            <div className="text-[9px] font-medium opacity-80 leading-tight">Recommended Safe Route</div>
          </div>

          {/* Fastest Route Card Overlay */}
          <div className="absolute bottom-[30%] right-[10%] bg-white rounded-2xl p-3 border-l-4 border-red-500 shadow-xl max-w-[140px]">
            <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1 text-red-500">Fastest Route</div>
            <div className="text-lg font-black mb-1 leading-none text-slate-800">{fast?.duration_mins || '15'} mins</div>
            <div className="flex items-center gap-1 text-xs font-semibold text-red-600">
              <AlertTriangle className="w-3 h-3" /> AQI {fast?.avg_aqi || '350'}
            </div>
            <div className="text-[9px] font-bold text-red-400 leading-tight">(Hazardous)</div>
          </div>

          {/* Floating Action Buttons */}
          <div className="absolute bottom-6 right-4 flex flex-col gap-2">
            <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors">
              <Layers className="w-5 h-5 text-slate-600" />
            </button>
            <button className="w-12 h-12 bg-[#22c55e] text-white rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center hover:bg-green-600 transition-colors">
              <Activity className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Health Advisory Ticket */}
      <div className="bg-white px-5 pt-4 pb-24 z-10 border-t border-slate-100 rounded-t-[24px]">
        <div className="bg-[#f0fdf4] border border-green-100 rounded-2xl p-4 flex gap-4 items-center">
          <div className="w-10 h-10 bg-[#dcfce7] rounded-xl flex items-center justify-center shrink-0">
            <ShieldPlus className="w-6 h-6 text-[#16a34a]" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Health Advisory</h4>
            <p className="text-[11px] font-medium text-slate-500 leading-snug">
              Low risk route selected. Reduced exposure to PM2.5 by 65%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tab: Profile & Symptoms ---
function ProfileTab() {
  const [profile, setProfile] = useState({ asthma_respiratory: true, elderly: false, children: true });
  const [activeToast, setActiveToast] = useState(null);

  useEffect(() => {
    // Fetch real API data
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${BASE_URL}/users/${USER_ID}/profile`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  const toggleUpdate = async (field, val) => {
    const updated = { ...profile, [field]: val };
    setProfile(updated); // Optimistic
    try {
      await fetch(`${BASE_URL}/users/${USER_ID}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updated, user_id: USER_ID })
      });
    } catch {
      setProfile(profile);
    }
  };

  const logSymptomAPI = async (level) => {
    try {
      const res = await fetch(`${BASE_URL}/users/${USER_ID}/symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: USER_ID, timestamp: new Date().toISOString(), symptom_level: level })
      });
      if (res.ok) {
        setActiveToast(`Logged: ${level.replace('_', ' ')}`);
        setTimeout(() => setActiveToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const CheckboxRow = ({ label, field, icon: Icon }) => {
    const isChecked = profile[field];
    return (
      <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer" onClick={() => toggleUpdate(field, !isChecked)}>
        <div className="flex items-center gap-3">
          {Icon && <Icon className={cn("w-5 h-5", isChecked ? "text-green-500" : "text-slate-400")} />}
          <span className="font-bold text-slate-800 text-sm">{label}</span>
        </div>
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center transition-colors",
          isChecked ? "bg-[#22c55e] border-none" : "bg-white border-2 border-slate-200"
        )}>
          {isChecked && <Check className="w-4 h-4 text-white stroke-[3]" />}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-white min-h-screen pb-24 animate-in slide-in-from-right-8 duration-300">
      <div className="px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-8">
          <ChevronLeft className="w-6 h-6 text-slate-800 cursor-pointer" />
          <h2 className="text-xl font-extrabold text-[#1f2937]">Health Profile</h2>
        </div>

        {/* Sensitive Groups block */}
        <div className="mb-10">
          <h3 className="font-extrabold text-2xl text-slate-900 mb-2">Sensitive Groups</h3>
          <p className="text-xs font-medium text-slate-500 mb-4">Select any that apply to receive tailored alerts.</p>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <CheckboxRow label="Asthma / Respiratory Issues" field="asthma_respiratory" icon={Wind} />
            <CheckboxRow label="Elderly (65+)" field="elderly" icon={Activity} />
            <CheckboxRow label="Children in Household" field="children" icon={Smile} />
          </div>
        </div>

        {/* Symptoms block */}
        <div>
          <h3 className="font-extrabold text-2xl text-slate-900 mb-1">How are you feeling today?</h3>
          <p className="text-xs font-medium italic text-slate-500 mb-6">Logging symptoms helps us adjust your personal safety alerts.</p>

          <div className="flex flex-col gap-3">
            {/* Green */}
            <button onClick={() => logSymptomAPI('Great')} className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 flex gap-4 items-center text-left hover:bg-[#dcfce7] transition-colors active:scale-[0.98]">
              <div className="w-12 h-12 rounded-full bg-[#22c55e] border-4 border-[#86efac] flex items-center justify-center shrink-0">
                <Smile className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Great</h4>
                <p className="text-xs font-medium text-slate-600">No issues or symptoms</p>
              </div>
            </button>

            {/* Orange */}
            <button onClick={() => logSymptomAPI('Coughing')} className="bg-[#fff7ed] border border-[#fed7aa] rounded-2xl p-4 flex gap-4 items-center text-left hover:bg-[#ffedd5] transition-colors active:scale-[0.98]">
               <div className="w-12 h-12 rounded-full bg-[#f97316] border-4 border-[#fdba74] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Cough/Wheezing</h4>
                <p className="text-xs font-medium text-slate-600">Mild respiratory irritation</p>
              </div>
            </button>

            {/* Red */}
            <button onClick={() => logSymptomAPI('Headache')} className="bg-[#fff1f2] border border-[#fecdd3] rounded-2xl p-4 flex gap-4 items-center text-left hover:bg-[#ffe4e6] transition-colors active:scale-[0.98]">
               <div className="w-12 h-12 rounded-full bg-[#ef4444] border-4 border-[#fda4af] flex items-center justify-center shrink-0">
                <Frown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Headache/Fatigue</h4>
                <p className="text-xs font-medium text-slate-600">Strong reaction to air quality</p>
              </div>
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#f8fafc] rounded-2xl p-4 border border-slate-100 flex gap-3 max-w-[90%] mx-auto items-start">
          <Info className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
            Based on your profile, we will prioritize alerts for high PM2.5 levels that specifically affect children and respiratory health.
          </p>
        </div>

        {/* Toast */}
        {activeToast && (
          <div className="fixed top-12 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 z-50 text-sm font-bold border border-slate-700">
            <Check className="w-4 h-4 text-green-400" />
            {activeToast}
          </div>
        )}

      </div>
    </div>
  );
}

// === Main Tab Orhcestrator ===
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    // Single load logic here keeps tab-swapping instant
    const loadCoreData = async () => {
      try {
        const res = await fetch(`${BASE_URL}/dashboard?user_id=${USER_ID}&lat=${DEFAULT_LAT}&lon=${DEFAULT_LON}`);
        if(res.ok) setDashboardData(await res.json());
      } catch (err) {
        console.error("Fetch block error:", err);
      }
    };
    loadCoreData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center selection:bg-blue-100">
      {/* Mobile container imitating a phone */}
      <div className="w-full max-w-[420px] bg-white min-h-screen shadow-2xl relative overflow-x-hidden flex flex-col">
        
        {/* Router View Window */}
        <div className="flex-1 overflow-x-hidden relative scroll-smooth overflow-y-auto no-scrollbar">
          {activeTab === 'home' && <HomeTab dashboardData={dashboardData} navigateTo={setActiveTab} />}
          {activeTab === 'map' && <MapTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </div>

        {/* Global Bottom Navigation (Matches Mockup) */}
        <div className="absolute bottom-0 w-full bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          
          <button onClick={()=>setActiveTab('home')} className={cn("flex flex-col items-center gap-1.5 transition-colors", activeTab === 'home' ? "text-[#22c55e]" : "text-slate-400")}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", activeTab === 'home' ? "bg-green-50 text-[#16a34a]" : "bg-transparent hover:bg-slate-50")}>
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'home' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className={cn("text-[10px] font-extrabold uppercase tracking-wide", activeTab === 'home' ? "text-slate-900" : "text-slate-400")}>Home</span>
          </button>

          <button onClick={()=>setActiveTab('map')} className={cn("flex flex-col items-center gap-1.5 transition-colors", activeTab === 'map' ? "text-[#22c55e]" : "text-slate-400")}>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", activeTab === 'map' ? "bg-green-50 text-[#16a34a]" : "bg-transparent hover:bg-slate-50")}>
               <MapPin className="w-5 h-5" fill={activeTab === 'map' ? "currentColor" : "none"} />
            </div>
            <span className={cn("text-[10px] font-extrabold uppercase tracking-wide", activeTab === 'map' ? "text-slate-900" : "text-slate-400")}>Map</span>
          </button>

          <button className="flex flex-col items-center gap-1.5 transition-colors text-slate-400 opacity-50 cursor-not-allowed">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-transparent">
               <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide">Analytics</span>
          </button>

          <button onClick={()=>setActiveTab('profile')} className={cn("flex flex-col items-center gap-1.5 transition-colors relative", activeTab === 'profile' ? "text-[#22c55e]" : "text-slate-400")}>
            {/* Mockup Profile Ping dot */}
            <div className="absolute top-1 right-2 w-2 h-2 bg-green-500 rounded-full border border-white z-10"></div>
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", activeTab === 'profile' ? "bg-green-50 text-[#16a34a]" : "bg-transparent hover:bg-slate-50")}>
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'profile' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <span className={cn("text-[10px] font-extrabold uppercase tracking-wide", activeTab === 'profile' ? "text-[#22c55e]" : "text-slate-400")}>Profile</span>
          </button>

        </div>
      </div>
    </div>
  );
}

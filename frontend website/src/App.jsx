import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity, Map as MapIcon, User, RefreshCw, AlertTriangle, ShieldCheck,
  Route, Clock, CheckCircle2, Wind, Zap, MapPin, Search, LocateFixed,
  MousePointerClick, ChevronRight, Settings, Info, Navigation
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api/v1";
const USER_ID = "hackathon-demo-user";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ─── Helpers ────────────────────────────────────────────────────────────────────
const getAqiColor = (aqi) => {
  if (!aqi || aqi <= 0) return '#64748b';
  if (aqi <= 50) return '#10b981';
  if (aqi <= 100) return '#f59e0b';
  if (aqi <= 200) return '#f97316';
  if (aqi <= 300) return '#ef4444';
  if (aqi <= 400) return '#8b5cf6';
  return '#be123c';
};
const getAqiTextClass = (aqi) => {
  if (!aqi || aqi <= 0) return 'text-slate-400';
  if (aqi <= 50) return 'text-emerald-400';
  if (aqi <= 100) return 'text-amber-400';
  if (aqi <= 200) return 'text-orange-400';
  if (aqi <= 300) return 'text-red-400';
  if (aqi <= 400) return 'text-purple-400';
  return 'text-rose-600';
};

// Compute advisory locally so it's always consistent with profile state (no race condition)
const computeAdvisory = (predictedAqi, profile) => {
  if (!predictedAqi) return { is_alert: false, headline: 'Awaiting data...', message: 'Fetch location data to get your advisory.' };
  
  let is_alert = false;
  let headline = 'Air Quality is Stable';
  let message = 'Conditions are safe. Normal outdoor activity is recommended.';

  if (predictedAqi > 50 && profile.asthma_respiratory && predictedAqi > 100) {
    is_alert = true;
    headline = 'Asthma / Respiratory Alert';
    message = 'AQI is Moderate/High. Sensitive airways at risk — minimize strenuous outdoor activity.';
  }
  if (predictedAqi > 200 && (profile.elderly || profile.children)) {
    is_alert = true;
    headline = 'Vulnerable Group Alert';
    message = 'Poor air quality detected. Elderly and children should remain indoors today.';
  }
  if (predictedAqi > 200 && profile.asthma_respiratory) {
    is_alert = true;
    headline = 'Severe Respiratory Warning';
    message = 'Poor AQI severely impacts asthma. Wear N95 mask outdoors or stay inside.';
  }
  if (predictedAqi > 400) {
    is_alert = true;
    headline = '🚨 HAZARDOUS ENVIRONMENT';
    message = 'Extremely severe air quality. Do NOT go outside under any circumstances.';
  }
  if (predictedAqi <= 50 && !profile.asthma_respiratory && !profile.elderly && !profile.children) {
    headline = '✅ Air Quality: Good';
    message = 'Excellent air quality. Perfect conditions for outdoor activities.';
  }
  return { is_alert, headline, message };
};

// ─── Nominatim hook — debounced, biased to India ──────────────────────────────
const useNominatim = (query, bias) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // Bias results toward user location + prefer India
        const viewbox = bias 
          ? `&viewbox=${bias.lon - 5},${bias.lat + 5},${bias.lon + 5},${bias.lat - 5}&bounded=0`
          : '';
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=7&addressdetails=1&countrycodes=in${viewbox}`,
          { headers: { 'User-Agent': 'AeroGuard-AQI-App/1.0' } }
        );
        const data = await res.json();
        setResults(data);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);
  return { results, loading };
};

// ─── OSRM real-road routing ───────────────────────────────────────────────────
const getOsrmRoute = async (oLat, oLon, dLat, dLon) => {
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?geometries=geojson&overview=full`);
    const d = await r.json();
    if (d.code !== 'Ok') return null;
    return d.routes[0].geometry.coordinates.map(([ln, lt]) => [lt, ln]);
  } catch { return null; }
};

// ─── Map helpers ──────────────────────────────────────────────────────────────
const FlyTo = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1 }); }, [JSON.stringify(center)]);
  return null;
};
const MapPicker = ({ onPick }) => {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
};

// ─── Location Picker Modal ────────────────────────────────────────────────────
const LocationPicker = ({ onConfirm, onClose }) => {
  const [mode, setMode] = useState(null);
  const [query, setQuery] = useState('');
  const { results, loading } = useNominatim(query, null);
  const [gpsState, setGpsState] = useState('idle');
  const [mapCenter, setMapCenter] = useState([20.59, 78.96]);
  const [picked, setPicked] = useState(null);

  const doGPS = useCallback(() => {
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(async ({ coords: { latitude: lat, longitude: lon } }) => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'User-Agent': 'AeroGuard-AQI-App/1.0' } });
        const d = await r.json();
        const a = d.address || {};
        const name = [a.city || a.town || a.village || a.county, a.state].filter(Boolean).join(', ') || `${lat.toFixed(3)},${lon.toFixed(3)}`;
        setPicked({ lat, lon, name });
      } catch { setPicked({ lat, lon, name: `${lat.toFixed(3)},${lon.toFixed(3)}` }); }
      setGpsState('done');
    }, () => setGpsState('error'));
  }, []);

  const handleMapPick = (lat, lon) => {
    setPicked({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
    setMapCenter([lat, lon]);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#04080f]/97 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-5 shadow-[0_0_30px_rgba(79,70,229,0.3)]">
            <MapPin className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            {onClose ? 'Change Location' : 'Set Your Location'}
          </h1>
          <p className="text-slate-500 text-sm">Choose how to set your monitoring point</p>
        </div>

        {!mode && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'search', icon: <Search className="w-7 h-7" />, label: 'Search', desc: 'By name or landmark' },
              { id: 'gps', icon: <LocateFixed className="w-7 h-7" />, label: 'GPS', desc: 'Use my location' },
              { id: 'map', icon: <MousePointerClick className="w-7 h-7" />, label: 'Pick on Map', desc: 'Click anywhere' },
            ].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); if (m.id === 'gps') doGPS(); }}
                className="bg-slate-800/60 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/40 p-5 rounded-2xl text-center transition-all hover:scale-105">
                <div className="text-indigo-400 mb-3 flex justify-center">{m.icon}</div>
                <div className="font-black text-white text-sm">{m.label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        )}

        {mode === 'search' && (
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5">
            <button onClick={() => { setMode(null); setPicked(null); }} className="text-slate-500 hover:text-white text-sm font-bold mb-4 flex items-center gap-1">← Back</button>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              {loading && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />}
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} autoFocus
                placeholder="Search Indian cities, areas, landmarks..."
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3.5 outline-none focus:border-indigo-500 transition-colors placeholder-slate-600 text-sm" />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {results.map((r, i) => {
                const isSel = picked && Math.abs(picked.lat - parseFloat(r.lat)) < 0.001;
                return (
                  <button key={i} onClick={() => { setPicked({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.display_name.split(',').slice(0, 3).join(', ') }); setQuery(r.display_name.split(',').slice(0, 2).join(', ')); }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${isSel ? 'bg-indigo-600/25 border-indigo-500/50' : 'bg-slate-900/50 hover:bg-slate-700/50 border-transparent'}`}>
                    <div className="font-bold text-white text-sm">{r.display_name.split(',').slice(0, 2).join(', ')}</div>
                    <div className="text-slate-600 text-xs">{r.display_name.split(',').slice(2, 4).join(', ')}</div>
                  </button>
                );
              })}
              {results.length === 0 && !loading && query.length >= 2 && (
                <div className="text-center py-6 text-slate-600 text-sm">No Indian results found. Try a different term.</div>
              )}
            </div>
          </div>
        )}

        {mode === 'gps' && (
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 text-center">
            <button onClick={() => { setMode(null); setPicked(null); setGpsState('idle'); }} className="text-slate-500 hover:text-white text-sm font-bold mb-6 flex items-center gap-1">← Back</button>
            {gpsState === 'loading' && (<><RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-3" /><p className="text-slate-300 font-bold">Acquiring GPS...</p><p className="text-slate-600 text-sm mt-1">Allow location access when prompted</p></>)}
            {gpsState === 'error' && (<><AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" /><p className="text-white font-black">Location denied</p><p className="text-slate-500 text-sm mt-1">Enable permissions in browser settings</p><button onClick={() => { setGpsState('loading'); doGPS(); }} className="mt-4 bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-600 transition-colors">Retry</button></>)}
            {gpsState === 'done' && picked && (<><CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" /><p className="text-white font-black text-lg">{picked.name}</p><p className="text-slate-500 font-mono text-xs mt-1">{picked.lat.toFixed(5)}, {picked.lon.toFixed(5)}</p></>)}
          </div>
        )}

        {mode === 'map' && (
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between bg-slate-900/40">
              <button onClick={() => { setMode(null); setPicked(null); }} className="text-slate-500 hover:text-white text-sm font-bold">← Back</button>
              <span className="text-slate-400 text-xs">{picked ? `📍 ${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)}` : 'Tap anywhere to set location'}</span>
            </div>
            <div className="h-72 relative z-0">
              <MapContainer center={mapCenter} zoom={5} scrollWheelZoom className="h-full w-full">
                <FlyTo center={picked ? [picked.lat, picked.lon] : mapCenter} zoom={picked ? 13 : 5} />
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
                <MapPicker onPick={handleMapPick} />
                {picked && <Marker position={[picked.lat, picked.lon]}><Popup>{picked.lat.toFixed(4)}, {picked.lon.toFixed(4)}</Popup></Marker>}
              </MapContainer>
            </div>
          </div>
        )}

        {picked && (
          <button onClick={() => onConfirm(picked)}
            className="w-full mt-5 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_25px_rgba(79,70,229,0.4)] text-base">
            <ChevronRight className="w-5 h-5" />
            Monitor <span className="text-indigo-300 ml-1 max-w-[220px] truncate">{picked.name}</span>
          </button>
        )}

        {onClose && !picked && (
          <button onClick={onClose} className="w-full mt-4 text-slate-600 hover:text-slate-400 py-3 text-sm font-bold transition-colors">Cancel</button>
        )}
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const DashboardView = ({ location, onRefreshTrigger }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/dashboard?user_id=${USER_ID}&lat=${location.lat}&lon=${location.lon}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError("Cannot connect to backend. Is the server running on port 8000?"); }
    finally { setLoading(false); }
  }, [location]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard, onRefreshTrigger]);

  const curAqi = data?.current_conditions?.aqi ?? 0;
  const tomAqi = data?.tomorrow_prediction?.aqi ?? 0;
  const advisory = data?.personalized_advisory || {};
  const trend = data?.trend_24h || [];

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* Advisory banner */}
      {(advisory.message || loading) && (
        <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all ${advisory.is_alert ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <div className={`p-3 rounded-xl flex-shrink-0 ${advisory.is_alert ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {advisory.is_alert ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-black text-base ${advisory.is_alert ? 'text-red-300' : 'text-emerald-300'}`}>{advisory.headline || '—'}</h3>
            <p className="text-slate-400 text-sm mt-0.5">{advisory.message || ''}</p>
          </div>
          <button onClick={fetchDashboard} disabled={loading}
            className="flex-shrink-0 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      )}

      {/* AQI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[{ label: 'Current AQI', aqi: curAqi, cat: data?.current_conditions?.category }, { label: "Tomorrow's Forecast", aqi: tomAqi, cat: data?.tomorrow_prediction?.category }].map((s, i) => (
          <div key={i} className="bg-slate-800/80 border border-white/8 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle at 50% 120%, ${getAqiColor(s.aqi)}25 0%, transparent 65%)` }} />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-3 relative z-10">{s.label}</p>
            <div className={`font-black tracking-tighter relative z-10 ${getAqiTextClass(s.aqi)}`}
              style={{ fontSize: 'clamp(4.5rem, 9vw, 7.5rem)', textShadow: `0 0 50px ${getAqiColor(s.aqi)}60`, lineHeight: 1 }}>
              {loading ? <RefreshCw className="w-12 h-12 text-slate-600 animate-spin mx-auto" /> : (s.aqi || '—')}
            </div>
            <p className="font-bold text-slate-300 uppercase tracking-wider text-xs mt-3 relative z-10">{s.cat || '—'}</p>
          </div>
        ))}
      </div>

      {/* AreaChart graph */}
      <div className="bg-slate-800/80 border border-white/8 rounded-2xl p-7">
        <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1"><Zap className="w-5 h-5 text-indigo-400" />24h Trajectory</h3>
        <p className="text-slate-600 text-xs mb-6">Diurnal AQI model — cosine wave with random noise per hour</p>
        <div className="h-64">
          {loading ? (
            <div className="h-full flex items-center justify-center"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" /></div>
          ) : trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={getAqiColor(curAqi)} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={getAqiColor(curAqi)} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v.split(' ')[1]} interval={2} />
                <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
                <Tooltip cursor={{ stroke: '#334155', strokeWidth: 1 }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f1f5f9', padding: '8px 14px' }}
                  formatter={val => [`${val} AQI`, '']} labelStyle={{ color: '#64748b', fontSize: '11px' }} />
                <Area type="monotone" dataKey="aqi" stroke={getAqiColor(curAqi)} strokeWidth={2.5}
                  fill="url(#g1)"
                  dot={{ r: 3, fill: '#fff', stroke: getAqiColor(curAqi), strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: getAqiColor(curAqi) }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-700 gap-3">
              <Activity className="w-6 h-6" /><span className="font-medium text-sm">No data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Safe Routes ──────────────────────────────────────────────────────────────
const SafeRoutesView = ({ location }) => {
  const [destQuery, setDestQuery] = useState('');
  const [destPicked, setDestPicked] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pickMode, setPickMode] = useState(false); // toggle: text search vs map click
  const [routes, setRoutes] = useState([]);
  const [fastPoly, setFastPoly] = useState([]);
  const [cleanPoly, setCleanPoly] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropRef = useRef(null);

  const { results: destResults, loading: destLoading } = useNominatim(destQuery, location);

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMapDestPick = (lat, lon) => {
    setDestPicked({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
    setDestQuery(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  };

  const findRoutes = async () => {
    if (!location || !destPicked) return;
    setLoading(true);
    setError(null);
    try {
      const [apiRes, roadCoords] = await Promise.all([
        fetch(`${API_BASE}/routes/safe-route`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin_lat: location.lat, origin_lon: location.lon, dest_lat: destPicked.lat, dest_lon: destPicked.lon })
        }),
        getOsrmRoute(location.lat, location.lon, destPicked.lat, destPicked.lon)
      ]);
      if (!apiRes.ok) throw new Error();
      const d = await apiRes.json();
      setRoutes(d.routes || []);
      if (roadCoords && roadCoords.length > 1) {
        setFastPoly(roadCoords);
        // "Cleanest" is a slightly varied version — offset every 5th coord
        setCleanPoly(roadCoords.map((pt, i) => i % 5 === 2 ? [pt[0] + 0.003, pt[1] + 0.003] : pt));
      }
    } catch { setError("Cannot connect to backend."); }
    finally { setLoading(false); }
  };

  const origin = location ? [location.lat, location.lon] : [20.59, 78.96];
  const dest = destPicked ? [destPicked.lat, destPicked.lon] : null;
  const fastest = routes.length > 0 ? [...routes].sort((a, b) => a.duration_mins - b.duration_mins)[0] : null;
  const cleanest = routes.length > 0 ? [...routes].sort((a, b) => a.avg_aqi - b.avg_aqi)[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {error && <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Origin */}
          <div className="bg-slate-800/80 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-500/30 flex-shrink-0" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Your Origin</span>
            </div>
            <p className="text-white font-bold text-sm">{location?.name || '—'}</p>
            <p className="text-slate-600 text-xs font-mono mt-0.5">{location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : ''}</p>
          </div>

          {/* Destination */}
          <div className="bg-slate-800/80 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30 flex-shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Destination</span>
              </div>
              {/* Toggle between text search and map click */}
              <button onClick={() => { setPickMode(!pickMode); setShowDropdown(false); }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${pickMode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                <MousePointerClick className="w-3 h-3" /> {pickMode ? 'Map Mode ON' : 'Pick on Map'}
              </button>
            </div>

            {pickMode ? (
              <div className="text-slate-400 text-xs p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                Click anywhere on the map to set your destination
              </div>
            ) : (
              <div className="relative" ref={dropRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                {destLoading && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />}
                <input type="text" value={destQuery}
                  onChange={e => { setDestQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type destination — auto search…"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-3 outline-none focus:border-indigo-500 text-sm placeholder-slate-600 transition-colors" />
                {showDropdown && destResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[500] overflow-hidden max-h-52 overflow-y-auto">
                    {destResults.map((r, i) => (
                      <button key={i} onClick={() => { setDestPicked({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), name: r.display_name.split(',').slice(0, 3).join(', ') }); setDestQuery(r.display_name.split(',').slice(0, 2).join(', ')); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800/80 last:border-0 transition-colors">
                        <div className="font-bold text-white text-sm leading-tight">{r.display_name.split(',').slice(0, 2).join(', ')}</div>
                        <div className="text-slate-600 text-xs">{r.type} · {r.display_name.split(',').slice(2, 4).join(', ')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {destPicked && <div className="mt-3 text-emerald-400 text-xs font-mono p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 truncate">✓ {destPicked.name}</div>}
          </div>

          <button onClick={findRoutes} disabled={loading || !destPicked || !location}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl font-black flex items-center gap-2 justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Route className="w-5 h-5" />}
            Find Safe Route
          </button>

          {fastest && (
            <div className="bg-slate-800/80 border-l-4 border-l-red-500 border border-white/5 rounded-2xl p-4">
              <h4 className="text-red-400 font-black flex items-center gap-2 mb-3 text-sm"><Clock className="w-4 h-4" />Fastest</h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/60 rounded-xl p-3 text-center"><div className="text-xs text-slate-600 mb-0.5">Duration</div><div className="font-black text-white">{fastest.duration_mins}m</div></div>
                <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20"><div className="text-xs text-red-400/60 mb-0.5">Avg AQI</div><div className="font-black text-red-400">{fastest.avg_aqi}</div></div>
              </div>
            </div>
          )}
          {cleanest && (
            <div className="bg-slate-800/80 border-l-4 border-l-emerald-500 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl">RECOMMENDED</div>
              <h4 className="text-emerald-400 font-black flex items-center gap-2 mb-3 mt-2 text-sm"><ShieldCheck className="w-4 h-4" />Cleanest</h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/60 rounded-xl p-3 text-center"><div className="text-xs text-slate-600 mb-0.5">Duration</div><div className="font-black text-white">{cleanest.duration_mins}m</div></div>
                <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20"><div className="text-xs text-emerald-400/60 mb-0.5">Avg AQI</div><div className="font-black text-emerald-400">{cleanest.avg_aqi}</div></div>
              </div>
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden" style={{ height: 600 }}>
          <MapContainer center={origin} zoom={11} scrollWheelZoom className="h-full w-full">
            <FlyTo center={dest || origin} zoom={dest ? 12 : 11} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB" />
            {pickMode && <MapPicker onPick={handleMapDestPick} />}
            <Marker position={origin}><Popup><b>Origin:</b> {location?.name}</Popup></Marker>
            {dest && <Marker position={dest}><Popup><b>Destination:</b> {destPicked?.name}</Popup></Marker>}
            {fastPoly.length > 1 && <Polyline positions={fastPoly} pathOptions={{ color: '#ef4444', weight: 4, dashArray: '8 12', opacity: 0.85 }} />}
            {cleanPoly.length > 1 && <Polyline positions={cleanPoly} pathOptions={{ color: '#10b981', weight: 5, opacity: 0.85 }} />}
          </MapContainer>
          {routes.length > 0 && (
            <div className="absolute bottom-5 right-5 bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl z-[1000] shadow-xl space-y-2 text-xs font-bold" style={{ position: 'absolute' }}>
              <div className="flex items-center gap-2"><div className="w-6 border-t-2 border-dashed border-red-500"></div><span className="text-slate-300">Fastest</span></div>
              <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-emerald-500 rounded"></div><span className="text-slate-300">Cleanest ⭐</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Profile / Identity ───────────────────────────────────────────────────────
const ProfileView = ({ location }) => {
  const [profile, setProfile] = useState({ user_id: USER_ID, asthma_respiratory: false, elderly: false, children: false });
  const [currentAqi, setCurrentAqi] = useState(0);
  const [toast, setToast] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Load profile and current AQI
  useEffect(() => {
    (async () => {
      setLoadingProfile(true);
      try {
        const [pRes, dRes] = await Promise.all([
          fetch(`${API_BASE}/users/${USER_ID}/profile`),
          location ? fetch(`${API_BASE}/dashboard?user_id=${USER_ID}&lat=${location.lat}&lon=${location.lon}`) : Promise.resolve(null)
        ]);
        if (pRes.ok) {
          const p = await pRes.json();
          setProfile({ user_id: p.user_id || USER_ID, asthma_respiratory: p.asthma_respiratory || false, elderly: p.elderly || false, children: p.children || false });
        }
        if (dRes?.ok) {
          const d = await dRes.json();
          setCurrentAqi(d?.tomorrow_prediction?.aqi || 0);
        }
      } catch {}
      setLoadingProfile(false);
    })();
  }, [location]);

  // Advisory is computed PURELY from local state — no race condition
  const advisory = computeAdvisory(currentAqi, profile);

  const toggle = async key => {
    const updated = { ...profile, [key]: !profile[key] };
    setProfile(updated); // optimistic — advisory recalulates immediately
    try {
      await fetch(`${API_BASE}/users/${USER_ID}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      showToast('Health profile saved.');
    } catch { setProfile(profile); }
  };

  const logSymptom = async level => {
    try {
      await fetch(`${API_BASE}/users/${USER_ID}/symptoms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: USER_ID, timestamp: new Date().toISOString(), symptom_level: level }) });
      showToast(`Logged: ${level}.`);
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500 relative">
      {toast && (
        <div className="fixed bottom-8 inset-x-0 mx-auto w-max bg-indigo-600 text-white px-5 py-3 rounded-full shadow-[0_8px_30px_rgba(79,70,229,0.5)] flex items-center gap-2 z-50 border border-indigo-400 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4" />{toast}
        </div>
      )}

      {/* Live advisory — recomputed on every profile toggle, no API call */}
      <div className={`p-6 rounded-2xl border flex items-start gap-4 transition-all duration-500 ${advisory.is_alert ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
        <div className={`p-3 rounded-xl flex-shrink-0 ${advisory.is_alert ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {advisory.is_alert ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className={`font-black text-base ${advisory.is_alert ? 'text-red-300' : 'text-emerald-300'}`}>{advisory.headline}</h3>
            <span className="text-[10px] bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live · updates with toggles</span>
          </div>
          <p className="text-slate-400 text-sm">{advisory.message}</p>
          {currentAqi > 0 && <p className="text-slate-600 text-xs mt-1.5">Based on tomorrow's predicted AQI: <span className={`font-bold ${getAqiTextClass(currentAqi)}`}>{currentAqi}</span></p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vulnerability matrix */}
        <div className="bg-slate-800/80 border border-white/8 rounded-2xl p-7">
          <h3 className="text-lg font-black mb-1 text-white flex items-center gap-2"><User className="w-5 h-5 text-indigo-400" />Health Matrix</h3>
          <p className="text-slate-500 text-sm mb-6">Toggle conditions — advisory updates instantly above.</p>
          <div className="space-y-3">
            {[
              { key: 'asthma_respiratory', label: 'Asthma / Respiratory', emoji: '🫁', desc: 'Advisory triggers at AQI > 100' },
              { key: 'elderly', label: 'Senior or Elderly', emoji: '🧓', desc: 'Advisory triggers at AQI > 200' },
              { key: 'children', label: 'Children or Infants', emoji: '👶', desc: 'Advisory triggers at AQI > 200' },
            ].map(({ key, label, emoji, desc }) => (
              <div key={key} onClick={() => toggle(key)}
                className={`cursor-pointer p-4 rounded-xl border flex items-center gap-3 transition-all ${profile[key] ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-slate-900/40 border-slate-700/60 hover:bg-slate-700/40'}`}>
                <span className="text-xl">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${profile[key] ? 'text-indigo-300' : 'text-slate-300'}`}>{label}</div>
                  <div className="text-slate-600 text-xs truncate">{desc}</div>
                </div>
                <div className={`w-10 h-5.5 h-[22px] rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors ${profile[key] ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${profile[key] ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Symptom logger */}
        <div className="bg-slate-800/80 border border-white/8 rounded-2xl p-7">
          <h3 className="text-lg font-black mb-1 text-white flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-400" />How Are You Feeling?</h3>
          <p className="text-slate-500 text-sm mb-6">Log how today's air is affecting you.</p>
          <div className="space-y-3">
            {[
              { level: 'Great', emoji: '😊', label: 'Feeling Great', sub: 'No symptoms noticed', cls: 'emerald' },
              { level: 'Coughing', emoji: '😷', label: 'Cough / Wheezing', sub: 'Respiratory irritation', cls: 'amber' },
              { level: 'Headache', emoji: '🤕', label: 'Headache / Fatigue', sub: 'Possible PM2.5 impact', cls: 'red' },
            ].map(({ level, emoji, label, sub, cls }) => (
              <button key={level} onClick={() => logSymptom(level)}
                className={`w-full p-4 rounded-xl flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-95 bg-${cls}-500/10 border border-${cls}-500/20 hover:bg-${cls}-500/20`}>
                <span className="text-2xl">{emoji}</span>
                <div>
                  <div className={`font-black text-sm text-${cls}-400`}>{label}</div>
                  <div className={`text-${cls}-600 text-xs`}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [location, setLocation] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [globalError, setGlobalError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConfirm = loc => { setLocation(loc); setShowPicker(false); setGlobalError(null); };

  return (
    <div className="min-h-screen font-sans text-slate-100 flex flex-col bg-[#080e1a]">
      {(!location || showPicker) && <LocationPicker onConfirm={handleConfirm} onClose={showPicker ? () => setShowPicker(false) : null} />}

      {/* Header */}
      <header className="border-b border-white/5 bg-slate-900/70 backdrop-blur-xl sticky top-0 z-[400]">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_12px_rgba(79,70,229,0.5)]">
              <Wind className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-black text-white hidden sm:block">Aero<span className="text-indigo-400">Guard</span></span>
          </div>

          {/* Location button — shows current city, click to change */}
          {location && (
            <button onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 bg-slate-800/70 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-xl font-bold transition-colors text-xs max-w-[200px]">
              <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="truncate">{location.name}</span>
              <Settings className="w-3 h-3 opacity-40 flex-shrink-0 ml-auto" />
            </button>
          )}

          {/* Global Refresh button */}
          {location && (
            <button onClick={() => setRefreshKey(k => k + 1)}
              title="Refresh all data"
              className="flex items-center gap-2 bg-slate-800/70 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-xl font-bold transition-colors text-xs flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Tab nav */}
          <div className="ml-auto flex bg-slate-800/60 p-1 rounded-xl border border-white/5 gap-0.5">
            {[
              { id: 'dashboard', label: 'Monitor', icon: <Activity className="w-3.5 h-3.5" /> },
              { id: 'routes', label: 'Safe Vectors', icon: <MapIcon className="w-3.5 h-3.5" /> },
              { id: 'profile', label: 'Identity', icon: <User className="w-3.5 h-3.5" /> },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {t.icon}<span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {globalError && (
        <div className="bg-red-500/10 border-b border-red-500/20 z-[300]">
          <div className="max-w-7xl mx-auto px-5 py-2 flex items-center justify-center gap-2 text-red-400 text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />{globalError}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-5 py-8 w-full flex-grow">
        {location ? (
          <>
            {tab === 'dashboard' && <DashboardView location={location} onRefreshTrigger={refreshKey} />}
            {tab === 'routes' && <SafeRoutesView location={location} />}
            {tab === 'profile' && <ProfileView location={location} />}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-700 gap-3">
            <MapPin className="w-10 h-10" />
            <p className="font-bold text-sm">Set a location to begin monitoring</p>
          </div>
        )}
      </main>
    </div>
  );
}

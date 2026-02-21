import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Shield, 
  Users, 
  Plus, 
  Minus,
  ChevronRight, 
  FileText, 
  Activity, 
  Calendar, 
  MessageSquare, 
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Stethoscope,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, MedicalRecord, DailyLog, InsurancePolicy, BenefitsSummary } from './types';
import { analyzeMedicalDocument, analyzeInsuranceDocument, getMacroRecommendations } from './services/geminiService';

// --- Components ---

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50 pointer-events-none"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Card = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 ${className}`} {...props}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, loading = false }: any) => {
  const base = "px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-teal-50 text-teal-700 hover:bg-teal-100",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-50"
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [activeTab, setActiveTab] = useState<'health' | 'insurance' | 'profiles'>('health');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'medical' | 'insurance' | null>(null);
  const [showPrivacyDisclaimer, setShowPrivacyDisclaimer] = useState(true);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfiles();
    const disclaimerSeen = localStorage.getItem('privacy_disclaimer_seen');
    if (disclaimerSeen) setShowPrivacyDisclaimer(false);
  }, []);

  useEffect(() => {
    if (activeProfile) {
      fetchData(activeProfile.id);
    }
  }, [activeProfile]);

  const fetchProfiles = async () => {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    setProfiles(data);
    if (data.length > 0 && !activeProfile) {
      setActiveProfile(data.find((p: any) => p.is_master) || data[0]);
    }
  };

  const fetchData = async (profileId: number) => {
    const [recRes, insRes, logRes] = await Promise.all([
      fetch(`/api/records/${profileId}`),
      fetch(`/api/insurance/${profileId}`),
      fetch(`/api/logs/${profileId}`)
    ]);
    setRecords(await recRes.json());
    setInsurance(await insRes.json());
    setLogs(await logRes.json());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProfile || !uploadType) return;

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        if (uploadType === 'medical') {
          const analysis = await analyzeMedicalDocument(base64, file.type);
          await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile_id: activeProfile.id,
              date: analysis.date,
              summary: analysis.summary,
              full_text: analysis.full_text_translated,
              type: analysis.type,
              follow_ups: analysis.follow_ups
            })
          });
        } else {
          const analysis = await analyzeInsuranceDocument(base64, file.type);
          await fetch('/api/insurance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile_id: activeProfile.id,
              type: analysis.type,
              provider: analysis.provider,
              benefits_summary: {
                terms: analysis.benefits,
                limits: analysis.limits,
                expiration: analysis.expiration
              }
            })
          });
        }
        fetchData(activeProfile.id);
        setIsUploading(false);
      } catch (err) {
        console.error("Analysis failed", err);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const addDailyLog = async (text: string) => {
    if (!activeProfile) return;
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: activeProfile.id,
        date: new Date().toISOString().split('T')[0],
        symptom_description: text
      })
    });
    fetchData(activeProfile.id);
  };

  const getRecommendations = async () => {
    if (!activeProfile || records.length === 0) return;
    setIsAnalyzing(true);
    try {
      const recs = await getMacroRecommendations(records);
      setRecommendations(recs || "No specific recommendations at this time.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dismissDisclaimer = () => {
    localStorage.setItem('privacy_disclaimer_seen', 'true');
    setShowPrivacyDisclaimer(false);
  };

  const updateUsage = async (policyId: number, limitIndex: number, delta: number) => {
    const policy = insurance.find(p => p.id === policyId);
    if (!policy) return;

    const benefits = JSON.parse(policy.benefits_summary);
    const limit = benefits.limits[limitIndex];
    if (!limit) return;

    const newUsed = Math.max(0, Math.min(limit.total, limit.used + delta));
    if (newUsed === limit.used) return;

    benefits.limits[limitIndex].used = newUsed;

    await fetch(`/api/insurance/${policyId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ benefits_summary: benefits })
    });

    if (activeProfile) fetchData(activeProfile.id);
  };

  const deleteRecord = async (id: number) => {
    // Removed confirm for better compatibility in preview environments
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    if (activeProfile) fetchData(activeProfile.id);
  };

  const deleteInsurance = async (id: number) => {
    // Removed confirm for better compatibility in preview environments
    await fetch(`/api/insurance/${id}`, { method: 'DELETE' });
    if (activeProfile) fetchData(activeProfile.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">PatientProfile</h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setActiveTab('profiles')}
              className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium">{activeProfile?.name || 'Select Profile'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Privacy Disclaimer */}
        <AnimatePresence>
          {showPrivacyDisclaimer && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-blue-50 border-blue-100 flex gap-4">
                <Shield className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 font-medium mb-2">Privacy First</p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    Your data is only sent to AI for a one-time analysis and is never stored in the cloud. Results are saved locally on your device.
                  </p>
                  <button 
                    onClick={dismissDisclaimer}
                    className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    Got it
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="secondary" 
                className="h-24 flex-col"
                onClick={() => { setUploadType('medical'); setIsUploading(true); }}
              >
                <Upload className="w-6 h-6" />
                <span>Upload Note</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex-col bg-white"
                onClick={() => {
                  const symptom = prompt("How are you feeling today?");
                  if (symptom) addDailyLog(symptom);
                }}
              >
                <Activity className="w-6 h-6 text-teal-600" />
                <span>Log Symptom</span>
              </Button>
            </div>

            {/* Recommendations Section */}
            <Card className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white border-none">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  <h3 className="font-bold">AI Health Strategy</h3>
                </div>
                <Button 
                  variant="ghost" 
                  className="text-white hover:bg-white/10 p-1 h-auto"
                  onClick={getRecommendations}
                  loading={isAnalyzing}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {recommendations ? (
                <p className="text-sm leading-relaxed opacity-90">{recommendations}</p>
              ) : (
                <p className="text-sm opacity-80">Tap the search icon to generate personalized health strategies based on your history.</p>
              )}
            </Card>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Medical Timeline
              </h3>
              {records.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No records yet. Upload your first doctor note.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => (
                    <Card key={record.id} className="hover:border-blue-200 transition-colors cursor-pointer group relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
                        className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex justify-between items-start mb-3 pr-8">
                        <div>
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{record.type}</span>
                          <h4 className="font-bold text-slate-800">{record.summary}</h4>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{record.date}</span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-4 italic">
                        "{record.full_text}"
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {JSON.parse(record.follow_ups || '[]').map((q: string, i: number) => (
                          <div key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {q}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Logs */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Symptom Log
              </h3>
              <div className="space-y-3">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-4 items-start">
                    <div className="w-2 h-2 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-800">{log.symptom_description}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">{log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insurance' && (
          <div className="space-y-6">
            <Button 
              variant="primary" 
              className="w-full h-14"
              onClick={() => { setUploadType('insurance'); setIsUploading(true); }}
            >
              <Upload className="w-5 h-5" />
              <span>Scan Insurance Card / EOB</span>
            </Button>

            {insurance.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No insurance data. Upload a card to see benefits.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {insurance.map(policy => {
                  const benefits = JSON.parse(policy.benefits_summary);
                  return (
                    <Card key={policy.id} className="overflow-hidden p-0">
                      <div className="bg-blue-600 p-4 text-white">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold">{policy.provider}</h4>
                            <span className="text-xs bg-white/20 px-2 py-1 rounded uppercase font-bold">{policy.type}</span>
                          </div>
                          <button 
                            onClick={() => deleteInsurance(policy.id)}
                            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-6 space-y-6">
                        <div className="space-y-4">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Benefits & Coverage</p>
                          <div className="space-y-3">
                            {benefits.terms && benefits.terms.map((term: any, i: number) => (
                              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-slate-600">{term.term}</span>
                                  <Tooltip text={term.explanation}>
                                    <HelpCircle className="w-3.5 h-3.5 text-slate-300 cursor-help" />
                                  </Tooltip>
                                </div>
                                <span className="text-sm font-bold text-slate-800">{term.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {benefits.limits && benefits.limits.length > 0 && (
                          <div className="space-y-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Usage Tracker</p>
                            {benefits.limits.map((limit: any, i: number) => (
                              <div key={i} className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-600 font-medium">{limit.label}</span>
                                    <Tooltip text={limit.explanation && limit.explanation.trim() !== "" ? limit.explanation : `This tracks your usage of ${limit.label} benefits. Gemini will provide a detailed explanation on your next document upload.`}>
                                      <HelpCircle className="w-3.5 h-3.5 text-slate-300 cursor-help" />
                                    </Tooltip>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => updateUsage(policy.id, i, -1)}
                                      className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="font-bold text-blue-600 min-w-[40px] text-center">{limit.used} / {limit.total}</span>
                                    <button 
                                      onClick={() => updateUsage(policy.id, i, 1)}
                                      className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                                    style={{ width: `${(limit.used / limit.total) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <AlertCircle className="w-4 h-4 text-orange-400" />
                            <span>Expires: {benefits.expiration || 'Unknown'}</span>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-700">Family Profiles</h3>
            <div className="grid gap-4">
              {profiles.map(profile => (
                <button 
                  key={profile.id}
                  onClick={() => { setActiveProfile(profile); setActiveTab('health'); }}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    activeProfile?.id === profile.id 
                      ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      profile.is_master ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">{profile.name}</p>
                      <p className="text-xs text-slate-500">{profile.relationship}</p>
                    </div>
                  </div>
                  {activeProfile?.id === profile.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                </button>
              ))}
              <Button 
                variant="outline" 
                className="h-16 border-dashed border-2"
                onClick={() => {
                  const name = prompt("Name?");
                  const rel = prompt("Relationship?");
                  if (name && rel) {
                    fetch('/api/profiles', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name, relationship: rel })
                    }).then(() => fetchProfiles());
                  }
                }}
              >
                <Plus className="w-5 h-5" />
                <span>Add Family Member</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 z-40">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <button 
            onClick={() => setActiveTab('health')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'health' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Health</span>
          </button>
          <button 
            onClick={() => setActiveTab('insurance')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'insurance' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <Shield className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Insurance</span>
          </button>
          <button 
            onClick={() => setActiveTab('profiles')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'profiles' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Profiles</span>
          </button>
        </div>
      </nav>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">
                    {uploadType === 'medical' ? 'Upload Medical Record' : 'Scan Insurance'}
                  </h3>
                  <button onClick={() => setIsUploading(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                >
                  {isAnalyzing ? (
                    <div className="space-y-4">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                      <p className="font-bold text-blue-600">Gemini is analyzing...</p>
                      <p className="text-xs text-slate-500">Extracting dates, jargon, and benefits.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Tap to select file</p>
                        <p className="text-sm text-slate-500">PDF, JPG, or PNG</p>
                      </div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={isAnalyzing}
                />

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setIsUploading(false)}>Cancel</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

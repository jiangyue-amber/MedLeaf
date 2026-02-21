import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Leaf,
  Shield, 
  Users, 
  Plus, 
  Minus,
  ChevronRight, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Stethoscope,
  HelpCircle,
  Sparkles,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, MedicalRecord, InsurancePolicy, BenefitsSummary, StructuredMedicalData, ChatMessage } from './types';
import { analyzeMedicalDocument, analyzeInsuranceDocument, getMacroRecommendations, chatWithAI } from './services/geminiService';

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
    primary: "bg-sky-500 text-white hover:bg-sky-600 shadow-sm",
    secondary: "bg-sky-50 text-sky-700 hover:bg-sky-100",
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
  const [activeTab, setActiveTab] = useState<'health' | 'insurance' | 'profiles' | 'advice'>('health');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'medical' | 'insurance' | null>(null);
  const [showPrivacyDisclaimer, setShowPrivacyDisclaimer] = useState(true);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

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

  const toggleRecord = (id: number) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchProfiles = async () => {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    setProfiles(data);
    if (data.length > 0 && !activeProfile) {
      setActiveProfile(data.find((p: any) => p.is_master) || data[0]);
    }
  };

  const fetchData = async (profileId: number) => {
    const [recRes, insRes] = await Promise.all([
      fetch(`/api/records/${profileId}`),
      fetch(`/api/insurance/${profileId}`)
    ]);
    setRecords(await recRes.json());
    setInsurance(await insRes.json());
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

  const getRecommendations = async () => {
    if (!activeProfile || records.length === 0) return;
    setIsAnalyzing(true);
    try {
      const recs = await getMacroRecommendations(records);
      setRecommendations(recs || "No specific recommendations at this time.");
      if (chatMessages.length === 0) {
        setChatMessages([
          { role: 'model', text: "Hello! I'm your MedLeaf Advice assistant. Based on your history, here are some initial thoughts:" },
          { role: 'model', text: recs || "I'm analyzing your records to provide the best health strategy." }
        ]);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !activeProfile) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', text: userMessage }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      const geminiHistory = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const response = await chatWithAI(records, geminiHistory);
      setChatMessages([...newMessages, { role: 'model', text: response || "I'm sorry, I couldn't process that request." }]);
    } catch (err) {
      console.error("Chat failed", err);
      setChatMessages([...newMessages, { role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
    } finally {
      setIsChatLoading(false);
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
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-800">MedLeaf</h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setActiveTab('profiles')}
              className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              <div className="w-6 h-6 bg-sky-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-sky-600" />
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
              <Card className="bg-sky-50 border-sky-100 flex gap-4">
                <Shield className="w-6 h-6 text-sky-600 shrink-0" />
                <div>
                  <p className="text-sm text-sky-800 font-medium mb-2">Privacy First</p>
                  <p className="text-sm text-sky-700 leading-relaxed">
                    Your data is only sent to AI for a one-time analysis and is never stored in the cloud. Results are saved locally on your device.
                  </p>
                  <button 
                    onClick={dismissDisclaimer}
                    className="mt-3 text-sm font-bold text-sky-600 hover:text-sky-700"
                  >
                    Got it
                  </button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'health' && (
          <div className="space-y-8">
            {/* Action Center */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upload Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setUploadType('medical'); setIsUploading(true); }}
                className="relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-sky-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6 h-40 flex flex-col justify-between text-white">
                  <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Upload Records</h3>
                    <p className="text-xs text-sky-100 opacity-80">Scan doctor notes or lab results</p>
                  </div>
                </div>
                {/* Decorative element */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
              </motion.div>

              {/* Advice Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('advice')}
                className="relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-300 to-sky-500 opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6 h-40 flex flex-col justify-between text-white">
                  <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Health Advice</h3>
                    <p className="text-xs text-sky-100 opacity-80">Chat with your AI health strategist</p>
                  </div>
                </div>
                {/* Decorative element */}
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all" />
              </motion.div>
            </div>

            {/* Timeline */}
            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="font-bold text-2xl text-slate-800 tracking-tight">Medical Timeline</h3>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Chronological History</p>
                </div>
                <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase">
                  {records.length} Records
                </div>
              </div>
              
              {records.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-sky-600 opacity-20" />
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-slate-200" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-2">Your timeline is empty</h4>
                    <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">
                      Upload your first doctor note or lab result to start your digital history.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => {
                    const isExpanded = expandedRecords.has(record.id);
                    let structuredData: StructuredMedicalData | null = null;
                    try {
                      structuredData = JSON.parse(record.full_text);
                    } catch (e) {}

                    return (
                      <Card 
                        key={record.id} 
                        className="hover:border-sky-200 transition-colors cursor-pointer group relative overflow-hidden"
                        onClick={() => toggleRecord(record.id)}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
                          className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="flex justify-between items-start pr-8">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">{record.type}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{record.date}</span>
                            </div>
                            <h4 className="font-bold text-slate-800">
                              {structuredData?.reason_for_visit || record.summary}
                            </h4>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="text-slate-300"
                          >
                            <ChevronRight className="w-5 h-5 rotate-90" />
                          </motion.div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-6 space-y-6">
                                {structuredData ? (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                      {structuredData.time && (
                                        <div>
                                          <span className="text-slate-400 font-bold uppercase block text-[9px]">Time</span>
                                          <span className="text-slate-700">{structuredData.time}</span>
                                        </div>
                                      )}
                                      {structuredData.hospital && (
                                        <div>
                                          <span className="text-slate-400 font-bold uppercase block text-[9px]">Hospital</span>
                                          <span className="text-slate-700">{structuredData.hospital}</span>
                                        </div>
                                      )}
                                    </div>

                                    {structuredData.symptoms && structuredData.symptoms.length > 0 && (
                                      <div>
                                        <span className="text-slate-400 font-bold uppercase block text-[9px] mb-1">Symptoms</span>
                                        <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                                          {structuredData.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                      </div>
                                    )}

                                    {structuredData.lab_results && structuredData.lab_results.length > 0 && (
                                      <div>
                                        <span className="text-slate-400 font-bold uppercase block text-[9px] mb-1">Lab Results</span>
                                        <div className="overflow-x-auto border border-slate-100 rounded-lg">
                                          <table className="w-full text-[10px] text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                                              <tr>
                                                <th className="px-2 py-1.5">Test</th>
                                                <th className="px-2 py-1.5">Result</th>
                                                <th className="px-2 py-1.5">Reference</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                              {structuredData.lab_results.map((r, i) => (
                                                <tr key={i}>
                                                  <td className="px-2 py-1.5 font-medium">{r.test}</td>
                                                  <td className="px-2 py-1.5">{r.result} {r.unit}</td>
                                                  <td className="px-2 py-1.5 text-slate-400">{r.reference_range}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {structuredData.diagnosis && (
                                      <div>
                                        <span className="text-slate-400 font-bold uppercase block text-[9px]">Diagnosis</span>
                                        <span className="text-slate-700 text-xs">{structuredData.diagnosis}</span>
                                      </div>
                                    )}
                                    
                                    {structuredData.plan && (
                                      <div>
                                        <span className="text-slate-400 font-bold uppercase block text-[9px]">Plan</span>
                                        <span className="text-slate-700 text-xs">{structuredData.plan}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-600 italic">
                                    "{record.full_text}"
                                  </p>
                                )}

                                <div className="space-y-2 pt-4 border-t border-slate-50">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Follow-up questions for doctor</p>
                                  <div className="space-y-2">
                                    {JSON.parse(record.follow_ups || '[]').map((q: string, i: number) => (
                                      <div key={i} className="text-[11px] bg-slate-50 text-slate-600 p-2 rounded-lg flex items-start gap-2 border border-slate-100">
                                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                                        <span>{q}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    );
                  })}
                </div>
              )}
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
                      <div className="bg-sky-500 p-4 text-white">
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
                                    <span className="font-bold text-sky-600 min-w-[40px] text-center">{limit.used} / {limit.total}</span>
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
                                    className="h-full bg-sky-500 rounded-full transition-all duration-500" 
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
                          <CheckCircle2 className="w-5 h-5 text-sky-500" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="flex flex-col h-[calc(100vh-16rem)]">
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">MedLeaf Advice</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                      Get personalized health strategies and insurance advice based on your medical history.
                    </p>
                  </div>
                  <Button 
                    onClick={getRecommendations} 
                    loading={isAnalyzing}
                    className="bg-sky-500 hover:bg-sky-600"
                  >
                    Generate Initial Strategy
                  </Button>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-sky-500 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="relative mt-4">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your health strategy..."
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                disabled={isChatLoading || !activeProfile}
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isChatLoading || !activeProfile}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-sky-600 hover:bg-sky-50 rounded-xl disabled:opacity-30 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
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
                      ? 'bg-sky-50 border-sky-200 ring-2 ring-sky-100' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      profile.is_master ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800">{profile.name}</p>
                      <p className="text-xs text-slate-500">{profile.relationship}</p>
                    </div>
                  </div>
                  {activeProfile?.id === profile.id && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
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
            className={`flex flex-col items-center gap-1 ${activeTab === 'health' ? 'text-sky-600' : 'text-slate-400'}`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Health</span>
          </button>
          <button 
            onClick={() => setActiveTab('insurance')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'insurance' ? 'text-sky-600' : 'text-slate-400'}`}
          >
            <Shield className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Insurance</span>
          </button>
          <button 
            onClick={() => setActiveTab('advice')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'advice' ? 'text-sky-600' : 'text-slate-400'}`}
          >
            <Sparkles className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Advice</span>
          </button>
          <button 
            onClick={() => setActiveTab('profiles')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'profiles' ? 'text-sky-600' : 'text-slate-400'}`}
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
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-sky-400 hover:bg-sky-50 transition-all cursor-pointer group"
                >
                  {isAnalyzing ? (
                    <div className="space-y-4">
                      <Loader2 className="w-12 h-12 text-sky-600 animate-spin mx-auto" />
                      <p className="font-bold text-sky-600">Gemini is analyzing...</p>
                      <p className="text-xs text-slate-500">Extracting dates, jargon, and benefits.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-sky-600" />
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

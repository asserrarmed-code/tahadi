import React, { useState } from 'react';
import { Database, RefreshCw, Layers, Users, HelpCircle, Activity } from 'lucide-react';
import { Room, QuizSet, Question } from '../types';

interface DatabaseVisualizerProps {
  room: Room | null;
  activeQuestion: Question | null;
  quizzes: QuizSet[];
}

export default function DatabaseVisualizer({ room, activeQuestion, quizzes }: DatabaseVisualizerProps) {
  const [showJson, setShowJson] = useState(false);

  // Statistics
  const roomStateLabels: Record<string, string> = {
    waiting: 'بانتظار التحاق التلاميذ باللوبي 🎒',
    question_countdown: 'العد التنازلي التمهيدي للسؤال ⏱️',
    question_active: 'تلقي الإجابات والتفاعل الحركي ⚡',
    question_result: 'مراجعة الإجابات الصحيحة ونسب التصويت 📊',
    leaderboard: 'عرض لوحة الصدارة والتنافس المثير 🚀',
    finished: 'التتويج النهائي لأبطال الحصة 👑'
  };

  const playersArr = room ? Object.values(room.players) : [];
  const answeredCount = playersArr.filter(p => p.answeredThisRound).length;

  return (
    <div className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-3xl shadow-xl space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-200">مُراقب قواعد البيانات الفورية والربط المتزامن 📡</h4>
            <p className="text-[10px] text-slate-400">محاكاة حية لعلاقة الأستاذ، البروجيكتور، وأجهزة التلاميذ بالصف</p>
          </div>
        </div>

        <button
          onClick={() => setShowJson(!showJson)}
          className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
        >
          {showJson ? '🔍 إخفاء كود الـ JSON التعبيري' : '💻 استعراض الكود الخام JSON للغرفة'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold">
        {/* Sync Node 1 */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[10px]">العقدة 1: الأستاذ</span>
            <span className="w-2.5 h-2.5 bg-emerald-505 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div className="text-white text-[11px] font-black font-sans leading-relaxed">
            👨‍🏫 لوحة التحكم والتشغيل الحية
          </div>
          <div className="text-[10px] text-indigo-300 font-semibold">
            متصلة وترسل إشارات بدء الجولات والتحكم بالعداد
          </div>
        </div>

        {/* Sync Node 2 */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[10px]">العقدة 2: البروجكتور</span>
            <span className="w-2.5 h-2.5 bg-emerald-505 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div className="text-white text-[11px] font-black font-sans leading-relaxed">
            📺 الشاشة الكبرى المباشرة بالقسم
          </div>
          <div className="text-[10px] text-teal-300 font-semibold">
            تستمع وتتحول لتلقي الرسوم والمؤقت والنتائج
          </div>
        </div>

        {/* Sync Node 3 */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-[10px]">العقدة 3: هواتف التلاميذ</span>
            <span className="w-2.5 h-2.5 bg-emerald-505 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
          <div className="text-white text-[11px] font-black font-sans leading-relaxed">
            🎒 أجهزة التلاميذ (موبايل/لوحة)
          </div>
          <div className="text-[10px] text-rose-300 font-semibold">
            عدد التلاميذ النشيطين حالياً: <b className="font-mono text-emerald-400 text-[11px]">{playersArr.length}</b>
          </div>
        </div>

        {/* Sync Status Info */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-slate-400 text-[10px] block">حالة المزامنة</span>
          <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-400">
            <Activity className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>{room ? roomStateLabels[room.state] : 'لم يتم فتح قاعة لغرفة نشطة للأن.'}</span>
          </div>
          {room && (
            <div className="text-[9px] text-slate-400 font-medium">
              الرمز PIN الموزع: <strong className="font-mono text-white text-[10px]">{room.pin}</strong> • إجابات الجولة الحالية: <strong className="text-emerald-400 font-mono text-[10px]">{answeredCount}/{playersArr.length}</strong>
            </div>
          )}
        </div>
      </div>

      {showJson && (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 overflow-auto max-h-72 text-left font-mono text-[10px] text-indigo-300 leading-relaxed shadow-inner">
          <pre>{JSON.stringify({ room, activeQuestion, quizzesCount: quizzes.length }, null, 2)}</pre>
        </div>
      )}

      {/* Decorative Simulated Wire Connection Line */}
      <div className="relative pt-1">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-indigo-505 from-indigo-500/20 via-emerald-500/30 to-rose-500/20 transform -translate-y-1/2 rounded-full"></div>
        <div className="flex justify-between text-[9px] text-slate-500 relative font-bold">
          <span>{`{ Node: teacher }`}</span>
          <span>{`{ Node: projector }`}</span>
          <span>{`{ Node: student_remote }`}</span>
          <span>{`{ Database: in_memory }`}</span>
        </div>
      </div>
    </div>
  );
}

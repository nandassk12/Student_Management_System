import React from 'react'

export function parseNarrative(text) {
  if (!text) return null;

  const data = {
    academicPerformance: [],
    courseEngagement: [],
    explanation: [],
    situation: '',
    coreRisk: '',
    advice: '',
    remarks: ''
  };

  const lines = text.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect section headers
    if (line.includes('1. ACADEMIC PERFORMANCE')) {
      currentSection = 'academic';
      continue;
    } else if (line.includes('2. COURSE ENGAGEMENT & ATTENDANCE')) {
      currentSection = 'engagement';
      continue;
    } else if (line.includes('[EXPLANATION FOR INDICATORS]')) {
      currentSection = 'explanation';
      continue;
    } else if (line.includes('AI OVERVIEW & INSIGHTS') || line.includes('AI OVERVIEW &amp; INSIGHTS')) {
      currentSection = 'insights';
      continue;
    } else if (line.includes('[TEACHER/ADVISOR REMARKS')) {
      currentSection = 'remarks';
      continue;
    }

    // Skip separator lines
    if (line.startsWith('---') || line.startsWith('===')) {
      continue;
    }

    // Parse depending on section
    if (currentSection === 'academic') {
      if (line.includes('|') && !line.includes('Subject')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          data.academicPerformance.push({
            subject: parts[0],
            grade: parts[1],
            status: parts[2]
          });
        }
      }
    } else if (currentSection === 'engagement') {
      if (line.includes('|') && !line.includes('Subject')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          data.courseEngagement.push({
            subject: parts[0],
            attendance: parts[1],
            status: parts[2]
          });
        }
      }
    } else if (currentSection === 'explanation') {
      if (line.startsWith('•') || line.startsWith('*')) {
        data.explanation.push(line.replace(/^[•*]\s*/, ''));
      } else {
        data.explanation.push(line);
      }
    } else if (currentSection === 'insights') {
      // Match both bullet-style (•) and dash-style (-) prefixes from backend
      const normalised = line.replace(/^[-•*]\s*/, '');
      if (/^situation:/i.test(normalised)) {
        data.situation = normalised.replace(/^situation:\s*/i, '');
      } else if (/^core risk:/i.test(normalised)) {
        data.coreRisk = normalised.replace(/^core risk:\s*/i, '');
      } else if (/^advice:/i.test(normalised)) {
        data.advice = normalised.replace(/^advice:\s*/i, '');
      }
    } else if (currentSection === 'remarks') {
      if (line.toLowerCase().includes('type additional notes') || line.toLowerCase().includes('intervention plans')) {
        continue;
      }
      if (data.remarks) {
        data.remarks += '\n' + line;
      } else {
        data.remarks = line;
      }
    }
  }

  // If we couldn't parse structured data, return null to fallback to raw rendering
  if (data.academicPerformance.length === 0 && data.courseEngagement.length === 0 && !data.situation && !data.remarks) {
    return null;
  }

  return data;
}

export default function RichNarrative({ text }) {
  const parsed = parseNarrative(text);

  if (!parsed) {
    // Fallback if parsing failed or text is unstructured
    return (
      <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0] text-[#0f172a]">
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Academic Performance Card */}
      {parsed.academicPerformance.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-3 border-b border-slate-100">
            <h5 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              1. Academic Performance Summary
            </h5>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Current Grade</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {parsed.academicPerformance.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.subject}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                        {item.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        item.status.toLowerCase().includes('track') 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Course Engagement & Attendance Card */}
      {parsed.courseEngagement.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-[#f8fafc] px-4 py-3 border-b border-slate-100">
            <h5 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              2. Course Engagement & Attendance
            </h5>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold bg-slate-50/50">
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Attendance %</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {parsed.courseEngagement.map((item, idx) => {
                  const attVal = parseFloat(item.attendance);
                  const isCritical = attVal < 75;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/30">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.subject}</td>
                      <td className={`px-4 py-3 font-bold ${isCritical ? 'text-rose-600' : 'text-slate-700'}`}>
                        {item.attendance}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-semibold ${
                          item.status.includes('Excellent')
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status.includes('Good')
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Explanation alert box */}
      {parsed.explanation.length > 0 && (
        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-900 space-y-2">
          <span className="font-bold flex items-center gap-1.5 text-amber-800">
            ⚠️ Engagement Indicators Alert
          </span>
          <ul className="list-disc pl-4 space-y-1 text-amber-800/90 leading-relaxed font-medium">
            {parsed.explanation.map((exp, idx) => (
              <li key={idx}>{exp}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Overview & Insights Card */}
      {(parsed.situation || parsed.coreRisk || parsed.advice) && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5 space-y-4 shadow-inner">
          <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            ✨ AI Overview & Insights
          </h5>
          
          <div className="space-y-3.5">
            {parsed.situation && (
              <div className="text-xs">
                <span className="font-bold text-[#475569] block mb-1">Current Situation:</span>
                <p className="text-slate-700 leading-relaxed font-medium">{parsed.situation}</p>
              </div>
            )}
            
            {parsed.coreRisk && (
              <div className="p-3 bg-red-50/70 border border-red-200/50 rounded-lg text-xs">
                <span className="font-bold text-red-800 block mb-1">🚨 Core Risk & Roadblocks:</span>
                <p className="text-red-700 leading-relaxed font-medium">{parsed.coreRisk}</p>
              </div>
            )}
            
            {parsed.advice && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/50 rounded-lg text-xs">
                <span className="font-bold text-emerald-800 block mb-1">💡 Actionable Advice for Faculty:</span>
                <p className="text-emerald-700 leading-relaxed font-medium">{parsed.advice}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remarks Section */}
      {parsed.remarks && parsed.remarks.trim() !== "" && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-2">
          <h5 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
            📝 Teacher / Advisor Remarks
          </h5>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap italic">
            "{parsed.remarks.trim()}"
          </p>
        </div>
      )}
    </div>
  )
}

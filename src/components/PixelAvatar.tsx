import React from 'react';

export type AvatarCharacter = 'producer' | 'professor' | 'antisocial' | 'nearmiss' | 'candidate';
export type AvatarMotion = 'idle' | 'furious' | 'groove' | 'jitter' | 'slam' | 'hired' | 'scan' | 'glint';

interface PixelAvatarProps {
  character: AvatarCharacter;
  motion?: AvatarMotion;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSpeech?: boolean;
  speechText?: string;
  isInspected?: boolean;
  score?: number;
  hasStamp?: boolean;
  className?: string;
  onClick?: () => void;
}

export const PixelAvatar: React.FC<PixelAvatarProps> = ({
  character,
  motion = 'idle',
  size = 'md',
  showSpeech = false,
  speechText = '',
  isInspected = false,
  score,
  hasStamp = false,
  className = '',
  onClick
}) => {
  const sizeClasses = {
    sm: 'w-24 h-28',
    md: 'w-36 h-44',
    lg: 'w-48 h-56',
    xl: 'w-60 h-72'
  }[size];

  // 根據動作選擇對應的賽璐珞微動效 class
  const getMotionClass = () => {
    switch (motion) {
      case 'furious':
        return 'animate-violent-shake';
      case 'groove':
        return 'animate-headbang-tilt';
      case 'jitter':
        return 'animate-micro-jitter';
      case 'slam':
        return 'animate-stamp-slam';
      case 'hired':
        return 'animate-impact-drop';
      case 'scan':
        return 'animate-scan-hover';
      case 'glint':
        return 'animate-idle-float';
      case 'idle':
      default:
        return 'animate-idle-float';
    }
  };

  return (
    <div 
      className={`relative inline-flex flex-col items-center select-none cursor-pointer group ${className}`}
      onClick={onClick}
    >
      {/* 說話氣泡 (Pixel Speech Bubble) */}
      {showSpeech && speechText && (
        <div className="absolute -top-14 z-30 max-w-[200px] bg-slate-900/95 border-2 border-amber-400 text-amber-200 text-[11px] font-pixel-alt p-2 rounded shadow-xl animate-pop-squish pointer-events-none">
          <p className="line-clamp-3 leading-tight">{speechText}</p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-400" />
        </div>
      )}

      {/* 評審打分看板與 X-Agent-Proof 蓋章 */}
      {score !== undefined && (
        <div className="absolute -top-6 right-0 z-20 flex flex-col items-end">
          <div className="bg-slate-950 border-2 border-emerald-400 text-emerald-300 font-pixel text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1.5 animate-stamp-slam">
            <span className="text-[10px] text-slate-400 font-mono">SCORE</span>
            <span className="text-sm font-bold text-amber-300">{score}</span>
          </div>
          {hasStamp && (
            <div className="mt-1 bg-emerald-500/90 text-slate-950 font-pixel text-[8px] px-1.5 py-0.5 rounded border border-emerald-300 uppercase tracking-wider rotate-6 animate-stamp-slam shadow-lg shadow-emerald-500/40">
              ✓ X-Agent-Proof
            </div>
          )}
        </div>
      )}

      {/* 角色立繪本體（帶整張抖動動態） */}
      <div className={`relative ${sizeClasses} ${getMotionClass()} transition-transform duration-200 group-hover:scale-105`}>
        {/* 背景光暈 */}
        {isInspected && (
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse" />
        )}

        {/* 角色 1: 王牌製作人 (Executive Producer) */}
        {character === 'producer' && (
          <svg viewBox="0 0 160 200" className="w-full h-full pixelated drop-shadow-2xl">
            {/* 陰影底座 */}
            <ellipse cx="80" cy="188" rx="45" ry="8" fill="#090d16" opacity="0.6" />

            {/* 身体 / 俐落風衣西裝 */}
            <path d="M 45 95 L 115 95 L 128 178 L 32 178 Z" fill="#1e1b4b" stroke="#0f172a" strokeWidth="4" />
            <path d="M 52 95 L 80 140 L 108 95 Z" fill="#312e81" />
            
            {/* 襯衫與領帶 */}
            <path d="M 68 95 L 80 120 L 92 95 Z" fill="#f8fafc" />
            <path d="M 76 100 L 80 135 L 84 100 Z" fill="#f59e0b" />

            {/* 西裝翻領與金釦 */}
            <path d="M 45 95 L 68 135 L 80 135 L 56 95 Z" fill="#4338ca" />
            <path d="M 115 95 L 92 135 L 80 135 L 104 95 Z" fill="#4338ca" />
            <circle cx="80" cy="150" r="3" fill="#fbbf24" />
            <circle cx="80" cy="165" r="3" fill="#fbbf24" />

            {/* 手持合約平板 */}
            <rect x="20" y="118" width="28" height="42" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" transform="rotate(-12 34 139)" />
            <rect x="24" y="124" width="20" height="4" fill="#bae6fd" transform="rotate(-12 34 139)" />
            <rect x="24" y="132" width="16" height="3" fill="#bae6fd" transform="rotate(-12 34 139)" />
            <rect x="24" y="139" width="18" height="3" fill="#bae6fd" transform="rotate(-12 34 139)" />

            {/* 臉部與皮膚 */}
            <rect x="52" y="38" width="56" height="58" rx="8" fill="#fcd34d" stroke="#0f172a" strokeWidth="4" />
            {/* 側臉賽璐珞陰影 */}
            <path d="M 52 50 L 58 96 L 52 96 Z" fill="#f59e0b" opacity="0.6" />

            {/* 俐落帥氣短髮 */}
            <path d="M 44 42 Q 80 16 116 42 L 116 52 L 108 36 L 52 36 L 44 52 Z" fill="#0f172a" />
            <path d="M 50 30 L 78 22 L 68 34 Z" fill="#334155" />

            {/* 標誌性黑墨鏡 */}
            <rect x="52" y="52" width="24" height="15" rx="3" fill="#09090b" stroke="#18181b" strokeWidth="2" />
            <rect x="84" y="52" width="24" height="15" rx="3" fill="#09090b" stroke="#18181b" strokeWidth="2" />
            <rect x="76" y="56" width="8" height="4" fill="#09090b" />
            {/* 墨鏡反光高光 */}
            <line x1="56" y1="55" x2="68" y2="64" stroke="#e0e7ff" strokeWidth="2.5" />
            <line x1="88" y1="55" x2="100" y2="64" stroke="#e0e7ff" strokeWidth="2.5" />

            {/* 墨鏡閃光 Star Glint */}
            <g className="animate-glint" transform="translate(100, 50)">
              <polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" fill="#ffffff" />
            </g>

            {/* 自信嘴角 */}
            <path d="M 72 82 Q 82 88 90 80" stroke="#b45309" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* 身旁跳動的 0G 金幣 */}
            <g transform="translate(122, 105)">
              <circle cx="12" cy="12" r="14" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
              <circle cx="12" cy="12" r="10" fill="#fef08a" />
              <text x="12" y="16" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#92400e" fontFamily="monospace">0G</text>
            </g>
          </svg>
        )}

        {/* 角色 2: Professor #014 (古典樂理權威) */}
        {character === 'professor' && (
          <svg viewBox="0 0 160 200" className="w-full h-full pixelated drop-shadow-2xl">
            <ellipse cx="80" cy="188" rx="42" ry="8" fill="#090d16" opacity="0.6" />

            {/* 西裝軀幹 */}
            <path d="M 48 95 L 112 95 L 122 178 L 38 178 Z" fill="#450a0a" stroke="#0f172a" strokeWidth="4" />
            <path d="M 64 95 L 80 130 L 96 95 Z" fill="#f8fafc" />

            {/* 標誌性紅領結 */}
            <polygon points="68,98 92,98 80,108" fill="#dc2626" />
            <polygon points="68,118 92,118 80,108" fill="#dc2626" />
            <circle cx="80" cy="108" r="4" fill="#991b1b" />

            {/* 懷抱五線譜夾與紅筆 */}
            <rect x="88" y="112" width="34" height="48" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="2" transform="rotate(-8 105 136)" />
            <rect x="92" y="118" width="26" height="4" fill="#f8fafc" transform="rotate(-8 105 136)" />
            <line x1="94" y1="128" x2="116" y2="128" stroke="#ef4444" strokeWidth="2" transform="rotate(-8 105 136)" />
            <line x1="94" y1="134" x2="114" y2="134" stroke="#94a3b8" strokeWidth="1.5" transform="rotate(-8 105 136)" />

            {/* 臉部與嚴肅皮膚 */}
            <rect x="52" y="42" width="56" height="54" rx="6" fill="#fde68a" stroke="#0f172a" strokeWidth="4" />
            {/* 嚴肅白髮 */}
            <path d="M 46 48 Q 80 22 114 48 L 118 64 L 110 44 L 50 44 L 42 64 Z" fill="#94a3b8" />
            <rect x="42" y="52" width="10" height="24" rx="3" fill="#94a3b8" />
            <rect x="108" y="52" width="10" height="24" rx="3" fill="#94a3b8" />

            {/* 緊蹙眉頭 */}
            <line x1="56" y1="52" x2="72" y2="58" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="104" y1="52" x2="88" y2="58" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* 金絲眼鏡與挑剔雙眼 */}
            <rect x="54" y="58" width="22" height="16" rx="2" fill="#e0f2fe" opacity="0.8" stroke="#ca8a04" strokeWidth="2.5" />
            <rect x="84" y="58" width="22" height="16" rx="2" fill="#e0f2fe" opacity="0.8" stroke="#ca8a04" strokeWidth="2.5" />
            <line x1="76" y1="64" x2="84" y2="64" stroke="#ca8a04" strokeWidth="3" />
            <circle cx="65" cy="66" r="3" fill="#0f172a" />
            <circle cx="95" cy="66" r="3" fill="#0f172a" />

            {/* 嫌棄撇嘴 */}
            <path d="M 66 84 Q 80 78 94 84" stroke="#92400e" strokeWidth="3" fill="none" strokeLinecap="round" />

            {/* 狂暴時頭頂冒青筋 Anger Vein */}
            {motion === 'furious' && (
              <path d="M 112 28 Q 118 34 112 40 M 118 34 Q 124 28 130 34" stroke="#ef4444" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            )}
          </svg>
        )}

        {/* 角色 3: Anti-Social #207 (龐克反叛評審) */}
        {character === 'antisocial' && (
          <svg viewBox="0 0 160 200" className="w-full h-full pixelated drop-shadow-2xl">
            <ellipse cx="80" cy="188" rx="42" ry="8" fill="#090d16" opacity="0.6" />

            {/* 龐克鉚釘皮衣 */}
            <path d="M 44 95 L 116 95 L 126 178 L 34 178 Z" fill="#09090b" stroke="#22c55e" strokeWidth="2.5" />
            <path d="M 52 95 L 80 148 L 108 95 Z" fill="#18181b" />
            {/* 螢光綠骷髏標誌 */}
            <circle cx="80" cy="136" r="7" fill="#4ade80" />
            <rect x="76" y="143" width="8" height="4" fill="#4ade80" />

            {/* 頸部大耳機 */}
            <path d="M 48 88 Q 80 102 112 88" stroke="#3f3f46" strokeWidth="8" fill="none" />
            <rect x="42" y="80" width="14" height="20" rx="4" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
            <rect x="104" y="80" width="14" height="20" rx="4" fill="#22c55e" stroke="#14532d" strokeWidth="2" />

            {/* 臉部與皮膚 */}
            <rect x="52" y="44" width="56" height="50" rx="6" fill="#fbcfe8" stroke="#09090b" strokeWidth="4" />

            {/* 螢光綠龐克挑染尖刺髮型 */}
            <polygon points="46,44 60,12 68,44" fill="#22c55e" stroke="#09090b" strokeWidth="2" />
            <polygon points="62,44 80,6 94,44" fill="#4ade80" stroke="#09090b" strokeWidth="2" />
            <polygon points="88,44 104,16 114,44" fill="#22c55e" stroke="#09090b" strokeWidth="2" />

            {/* 斜戴深色長方形墨鏡 */}
            <g transform="rotate(-6 80 65)">
              <rect x="48" y="56" width="64" height="16" rx="3" fill="#18181b" stroke="#4ade80" strokeWidth="2" />
              <line x1="54" y1="60" x2="72" y2="68" stroke="#22c55e" strokeWidth="2" />
              <line x1="86" y1="60" x2="104" y2="68" stroke="#22c55e" strokeWidth="2" />
            </g>

            {/* 狂傲壞笑與舌頭 */}
            <path d="M 68 80 Q 80 94 92 80 Z" fill="#991b1b" stroke="#09090b" strokeWidth="2" />
            <circle cx="80" cy="85" r="3" fill="#f43f5e" />

            {/* 音樂音符粒子 */}
            <text x="122" y="60" fontSize="16" fill="#4ade80" className="animate-bounce">♬</text>
          </svg>
        )}

        {/* 角色 4: Near-Miss Killer #031 (微距強迫症評審) */}
        {character === 'nearmiss' && (
          <svg viewBox="0 0 160 200" className="w-full h-full pixelated drop-shadow-2xl">
            <ellipse cx="80" cy="188" rx="42" ry="8" fill="#090d16" opacity="0.6" />

            {/* 白大褂 */}
            <path d="M 44 95 L 116 95 L 126 178 L 34 178 Z" fill="#f8fafc" stroke="#0f172a" strokeWidth="4" />
            <path d="M 62 95 L 80 135 L 98 95 Z" fill="#0284c7" />
            <rect x="76" y="100" width="8" height="28" fill="#e0f2fe" />

            {/* 手持金屬游標卡尺 (Caliper) */}
            <g transform="translate(18, 120) rotate(-18)">
              <rect x="0" y="0" width="70" height="8" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
              <rect x="12" y="-12" width="6" height="32" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
              <rect x="36" y="-8" width="8" height="24" fill="#f43f5e" stroke="#881337" strokeWidth="2" />
              <line x1="20" y1="2" x2="20" y2="6" stroke="#0f172a" strokeWidth="1" />
              <line x1="26" y1="2" x2="26" y2="6" stroke="#0f172a" strokeWidth="1" />
              <line x1="32" y1="2" x2="32" y2="6" stroke="#0f172a" strokeWidth="1" />
            </g>

            {/* 臉部與神經質皮膚 */}
            <rect x="52" y="44" width="56" height="52" rx="4" fill="#fed7aa" stroke="#0f172a" strokeWidth="4" />

            {/* 凌亂的研究員短髮 */}
            <path d="M 48 44 Q 80 18 112 44 L 114 52 L 50 52 Z" fill="#475569" />
            <polygon points="54,42 60,26 66,42" fill="#475569" />
            <polygon points="76,40 82,22 88,40" fill="#475569" />
            <polygon points="96,42 102,28 108,42" fill="#475569" />

            {/* 單側巨大放大眼鏡（觀察半音微差距） */}
            <circle cx="64" cy="66" r="14" fill="#cffafe" stroke="#0284c7" strokeWidth="3" opacity="0.85" />
            <circle cx="64" cy="66" r="7" fill="#0f172a" />
            <circle cx="66" cy="64" r="2.5" fill="#ffffff" />

            {/* 另一側細瞇眼 */}
            <line x1="88" y1="66" x2="102" y2="66" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />

            {/* 專注張大的O型小嘴 */}
            <ellipse cx="80" cy="85" rx="5" ry="4" fill="#9a3412" />

            {/* 微差距標註 (40 cents) */}
            <text x="110" y="82" fontSize="9" fontWeight="bold" fill="#f43f5e" fontFamily="monospace">±40¢</text>
          </svg>
        )}

        {/* 角色 5: 市集待命候選評審 (Marketplace Candidate) */}
        {character === 'candidate' && (
          <svg viewBox="0 0 160 200" className="w-full h-full pixelated opacity-60 group-hover:opacity-100 transition-opacity">
            <ellipse cx="80" cy="188" rx="38" ry="6" fill="#090d16" opacity="0.4" />
            <rect x="52" y="105" width="56" height="72" rx="4" fill="#334155" />
            <circle cx="80" cy="70" r="28" fill="#64748b" />
            <rect x="68" y="62" width="24" height="8" rx="2" fill="#0f172a" />
            <text x="80" y="145" fontSize="12" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">STANDBY</text>
          </svg>
        )}
      </div>

      {/* 角色名牌與身份標籤 */}
      <div className="mt-2 text-center">
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-pixel tracking-wider bg-slate-900 border border-slate-700 text-slate-200">
          {character === 'producer' && 'PRODUCER AGENT'}
          {character === 'professor' && 'PROFESSOR #014'}
          {character === 'antisocial' && 'ANTI-SOCIAL #207'}
          {character === 'nearmiss' && 'NEAR-MISS #031'}
          {character === 'candidate' && 'POP CRITIC #088'}
        </span>
      </div>
    </div>
  );
};

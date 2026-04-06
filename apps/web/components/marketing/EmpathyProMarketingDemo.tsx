"use client";

import React, { useState } from "react";
import {
  Activity,
  Heart,
  Zap,
  TrendingUp,
  Brain,
  Cpu,
  Wind,
  Flame,
} from "lucide-react";
import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";

type VisualStyle = "cyber" | "minimal" | "matrix" | "finale";

const STYLE_LABELS: Record<VisualStyle, string> = {
  cyber: "Cyber Glass",
  minimal: "Minimal 3D",
  matrix: "Matrix Multi",
  finale: "FINALE",
};

export function EmpathyProMarketingDemo() {
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("finale");

  const matrixEnabled =
    visualStyle === "matrix" || visualStyle === "finale";
  const glassStrong = visualStyle === "cyber" || visualStyle === "finale";
  const singleSeriesChart =
    visualStyle === "minimal" || visualStyle === "finale";

  const powerData = [
    { time: "0:00", power: 180, hr: 145, cadence: 85 },
    { time: "0:10", power: 220, hr: 152, cadence: 88 },
    { time: "0:20", power: 280, hr: 165, cadence: 92 },
    { time: "0:30", power: 340, hr: 175, cadence: 95 },
    { time: "0:40", power: 380, hr: 182, cadence: 98 },
    { time: "0:50", power: 320, hr: 178, cadence: 93 },
    { time: "1:00", power: 280, hr: 170, cadence: 90 },
    { time: "1:10", power: 240, hr: 160, cadence: 87 },
    { time: "1:20", power: 200, hr: 150, cadence: 84 },
    { time: "1:30", power: 180, hr: 145, cadence: 82 },
  ];

  const radarData = [
    { subject: "VO2 Max", value: 92, fullMark: 100 },
    { subject: "FTP", value: 88, fullMark: 100 },
    { subject: "Anaerobic", value: 85, fullMark: 100 },
    { subject: "Endurance", value: 95, fullMark: 100 },
    { subject: "Recovery", value: 78, fullMark: 100 },
    { subject: "Efficiency", value: 90, fullMark: 100 },
  ];

  const lactateData = [
    { intensity: "60%", lactate: 1.2 },
    { intensity: "70%", lactate: 1.8 },
    { intensity: "80%", lactate: 2.5 },
    { intensity: "85%", lactate: 3.2 },
    { intensity: "90%", lactate: 4.8 },
    { intensity: "95%", lactate: 7.2 },
    { intensity: "100%", lactate: 11.5 },
  ];

  const cardSurface = glassStrong
    ? "bg-white/5 backdrop-blur-xl border-white/10"
    : "bg-neutral-900/80 backdrop-blur-md border-white/5";

  const metrics = [
    {
      label: "Heart Rate",
      value: "165",
      unit: "BPM",
      color: "from-red-500 to-pink-500",
      shadow: "shadow-red-500/50",
      icon: Heart,
    },
    {
      label: "Power Output",
      value: "340",
      unit: "W",
      color: "from-orange-500 to-yellow-500",
      shadow: "shadow-orange-500/50",
      icon: Zap,
    },
    {
      label: "VO2 Max",
      value: "68.4",
      unit: "ml/kg/min",
      color: "from-purple-500 to-pink-500",
      shadow: "shadow-purple-500/50",
      icon: Wind,
    },
    {
      label: "Lactate",
      value: "4.2",
      unit: "mmol/L",
      color: "from-pink-500 to-rose-500",
      shadow: "shadow-pink-500/50",
      icon: Flame,
    },
  ] as const;

  const statusCards = [
    {
      title: "Neural Load",
      value: "78%",
      status: "Optimal",
      color: "from-purple-500 to-violet-500",
      icon: Brain,
    },
    {
      title: "AI Analysis",
      value: "98.7%",
      status: "Active",
      color: "from-pink-500 to-rose-500",
      icon: Cpu,
    },
    {
      title: "Recovery Index",
      value: "85%",
      status: "Good",
      color: "from-orange-500 to-amber-500",
      icon: TrendingUp,
    },
    {
      title: "Efficiency",
      value: "92%",
      status: "Excellent",
      color: "from-cyan-500 to-blue-500",
      icon: Activity,
    },
  ] as const;

  return (
    <BrutalistAppBackdrop matrix={matrixEnabled}>
      <div className="container mx-auto px-8 py-12">
        <p className="text-center text-xs uppercase tracking-widest text-amber-200/90 mb-6 border border-amber-400/30 rounded-full py-2 px-4 max-w-xl mx-auto bg-amber-500/5">
          Dati dimostrativi — illustrazione UI marketing, non telemetria reale
        </p>

        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-block mb-6 px-6 py-2 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/30 rounded-full backdrop-blur-xl">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent text-sm font-bold tracking-wider">
              EMPATHY PERFORMANCE • PRO 2.0
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black mb-6">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              EMPATHY PRO
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-400 max-w-3xl mx-auto">
            Advanced Physiological Analysis &amp; 3D Biomechanical Intelligence
            Platform
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {(Object.keys(STYLE_LABELS) as VisualStyle[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setVisualStyle(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all border ${
                visualStyle === key
                  ? "bg-gradient-to-r from-purple-600 to-orange-500 border-transparent text-white shadow-lg shadow-purple-500/30"
                  : "bg-white/5 border-white/15 text-gray-300 hover:border-purple-500/40"
              }`}
            >
              {key === "finale" ? "🔥 " : ""}
              {STYLE_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08 * i }}
                className={`${cardSurface} border rounded-3xl p-6 hover:border-purple-500/50 transition-all group cursor-default relative overflow-hidden`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <motion.div
                    className={`w-16 h-16 bg-gradient-to-br ${metric.color} rounded-2xl flex items-center justify-center mb-4 ${metric.shadow} shadow-lg`}
                    whileHover={{ scale: 1.06 }}
                  >
                    <Icon className="w-8 h-8 text-white" aria-hidden />
                  </motion.div>
                  <div className="text-4xl sm:text-5xl font-black mb-1 tabular-nums">
                    {metric.value}
                  </div>
                  <div className="text-gray-400 text-sm mb-3">{metric.unit}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    {metric.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`${cardSurface} border rounded-3xl p-8 hover:border-purple-500/50 transition-all`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5" aria-hidden />
                </div>
                Performance Metrics
              </h2>
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-mono">LIVE (demo)</span>
              </div>
            </div>

            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={powerData}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCadence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.85} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorHeroSingle"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.9} />
                      <stop offset="50%" stopColor="#ec4899" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" stroke="#888" />
                  <YAxis stroke="#888" domain={[0, 400]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0, 0, 0, 0.9)",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      borderRadius: "12px",
                    }}
                  />
                  {singleSeriesChart ? (
                    <Area
                      type="monotone"
                      dataKey="power"
                      stroke="#f97316"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorHeroSingle)"
                    />
                  ) : (
                    <>
                      <Area
                        type="monotone"
                        dataKey="power"
                        stroke="#a855f7"
                        fillOpacity={1}
                        fill="url(#colorPower)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="hr"
                        stroke="#ec4899"
                        fillOpacity={1}
                        fill="url(#colorHR)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="cadence"
                        stroke="#f97316"
                        fillOpacity={1}
                        fill="url(#colorCadence)"
                        strokeWidth={2}
                      />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full" />
                <span className="text-sm text-gray-400">Power (W)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pink-500 rounded-full" />
                <span className="text-sm text-gray-400">Heart Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span className="text-sm text-gray-400">Cadence</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className={`${cardSurface} border rounded-3xl p-8 hover:border-pink-500/50 transition-all`}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" aria-hidden />
                </div>
                Performance Profile
              </h2>
            </div>

            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#ffffff20" />
                  <PolarAngleAxis dataKey="subject" stroke="#888" />
                  <PolarRadiusAxis stroke="#888" domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#ec4899"
                    fill="#ec4899"
                    fillOpacity={0.55}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-center mt-6">
              <div className="text-sm text-gray-400">
                Overall Performance Score (demo)
              </div>
              <div className="text-4xl font-black bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mt-2">
                88.3<span className="text-xl">/100</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className={`${cardSurface} border rounded-3xl p-8 hover:border-orange-500/50 transition-all mb-12`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5" aria-hidden />
              </div>
              Lactate Threshold Analysis
            </h2>
            <div className="text-sm text-gray-400">
              VLaMax:{" "}
              <span className="text-orange-400 font-bold">0.42 mmol/L/s</span>{" "}
              <span className="text-gray-500">(demo)</span>
            </div>
          </div>

          <div className="h-[350px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lactateData}>
                <defs>
                  <linearGradient id="colorLactate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.85} />
                    <stop offset="50%" stopColor="#ec4899" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="intensity" stroke="#888" />
                <YAxis
                  stroke="#888"
                  domain={[0, 12]}
                  label={{
                    value: "Lactate (mmol/L)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#888",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0, 0, 0, 0.9)",
                    border: "1px solid rgba(249, 115, 22, 0.3)",
                    borderRadius: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="lactate"
                  stroke="#f97316"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorLactate)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            <div className="bg-black/30 rounded-2xl p-6 border border-orange-500/20">
              <div className="text-sm text-gray-400 mb-2">LT1 (Aerobic)</div>
              <div className="text-3xl font-black text-orange-400">260W</div>
              <div className="text-xs text-gray-500 mt-1">@ 2.0 mmol/L</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-6 border border-pink-500/20">
              <div className="text-sm text-gray-400 mb-2">LT2 (Anaerobic)</div>
              <div className="text-3xl font-black text-pink-400">320W</div>
              <div className="text-xs text-gray-500 mt-1">@ 4.0 mmol/L</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-6 border border-purple-500/20">
              <div className="text-sm text-gray-400 mb-2">Max Lactate</div>
              <div className="text-3xl font-black text-purple-400">11.5</div>
              <div className="text-xs text-gray-500 mt-1">mmol/L</div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-12">
          {statusCards.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.06 }}
                className={`${cardSurface} border rounded-3xl p-6 hover:border-white/30 transition-all`}
              >
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-4`}
                >
                  <Icon className="w-6 h-6" aria-hidden />
                </div>
                <div className="text-sm text-gray-400 mb-2">{item.title}</div>
                <div className="text-3xl font-black mb-1">{item.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  {item.status}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </BrutalistAppBackdrop>
  );
}

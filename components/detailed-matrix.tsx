"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Star, Target, Award, BarChart3, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailedMatrixProps {
  salesReps: any[];
  historicalReports?: any[];
  className?: string;
}

const COLORS = {
  daily: "#3b82f6",
  weekly: "#8b5cf6", 
  monthly: "#10b981",
  quality: "#f59e0b",
  staff: "#10b981",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-gray-200 dark:border-zinc-800 rounded-lg shadow-lg p-4 min-w-[180px]">
        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-3">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-medium text-gray-700 dark:text-zinc-300 capitalize">{entry.name}</span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {entry.name.toLowerCase().includes('quality') || entry.name.toLowerCase().includes('score')
                ? `${entry.value}/10` 
                : `${entry.value}`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function DetailedMatrix({ salesReps, historicalReports = [], className }: DetailedMatrixProps) {
  const [timePeriod, setTimePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [qualityTimePeriod, setQualityTimePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metricType, setMetricType] = useState<'conversions' | 'leads'>('conversions');

  // Verify real data existence
  const hasRealData = historicalReports && historicalReports.length > 0;

  // Real Daily Data (Last 7 Days)
  const realDailyData = useMemo(() => {
    if (!hasRealData) return [];
    const today = new Date();
    const list: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      const dayReports = historicalReports.filter(r => r.report_date === dStr);
      const leads = dayReports.reduce((sum, r) => sum + (r.total_leads || 0), 0);
      const conversions = dayReports.reduce((sum, r) => sum + (r.conversions || 0), 0);
      const avgQuality = dayReports.length > 0 ? (dayReports.reduce((sum, r) => sum + (r.lead_quality_rating || 0), 0) / dayReports.length) : 0;
      
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      list.push({ period: label, conversions, leads, quality: Number(avgQuality.toFixed(1)) });
    }
    return list;
  }, [historicalReports, hasRealData]);

  // Real Weekly Data (Last 4 Weeks)
  const realWeeklyData = useMemo(() => {
    if (!hasRealData) return [];
    const list: any[] = [];
    const today = new Date();
    for (let w = 3; w >= 0; w--) {
      const end = new Date(today);
      end.setDate(today.getDate() - w * 7);
      const start = new Date(today);
      start.setDate(today.getDate() - (w + 1) * 7 + 1);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      
      const weekReports = historicalReports.filter(r => r.report_date >= startStr && r.report_date <= endStr);
      const leads = weekReports.reduce((sum, r) => sum + (r.total_leads || 0), 0);
      const conversions = weekReports.reduce((sum, r) => sum + (r.conversions || 0), 0);
      const avgQuality = weekReports.length > 0 ? (weekReports.reduce((sum, r) => sum + (r.lead_quality_rating || 0), 0) / weekReports.length) : 0;
      
      list.push({ period: `Week ${4 - w}`, conversions, leads, quality: Number(avgQuality.toFixed(1)) });
    }
    return list;
  }, [historicalReports, hasRealData]);

  // Real Monthly Data (Last 6 Months)
  const realMonthlyData = useMemo(() => {
    if (!hasRealData) return [];
    const list: any[] = [];
    const today = new Date();
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
      const yearMonthStr = d.toISOString().slice(0, 7); // "2026-05"
      
      const monthReports = historicalReports.filter(r => r.report_date.startsWith(yearMonthStr));
      const leads = monthReports.reduce((sum, r) => sum + (r.total_leads || 0), 0);
      const conversions = monthReports.reduce((sum, r) => sum + (r.conversions || 0), 0);
      const avgQuality = monthReports.length > 0 ? (monthReports.reduce((sum, r) => sum + (r.lead_quality_rating || 0), 0) / monthReports.length) : 0;
      
      list.push({ period: monthLabel, conversions, leads, quality: Number(avgQuality.toFixed(1)) });
    }
    return list;
  }, [historicalReports, hasRealData]);

  // Real Staff Performance Data
  const realStaffData = useMemo(() => {
    return salesReps.map(rep => ({
      staff: rep.name,
      leads: rep.leadsClaimed,
      conversions: rep.closed
    }));
  }, [salesReps]);

  const conversionData = useMemo(() => {
    switch (timePeriod) {
      case 'weekly': return realWeeklyData;
      case 'monthly': return realMonthlyData;
      default: return realDailyData;
    }
  }, [timePeriod, realDailyData, realWeeklyData, realMonthlyData]);

  const qualityData = useMemo(() => {
    switch (qualityTimePeriod) {
      case 'weekly': return realWeeklyData;
      case 'monthly': return realMonthlyData;
      default: return realDailyData;
    }
  }, [qualityTimePeriod, realDailyData, realWeeklyData, realMonthlyData]);

  // Dynamic Insight Calculations
  const insights = useMemo(() => {
    if (conversionData.length === 0) return null;
    const valueKey = metricType === 'leads' ? 'leads' : 'conversions';
    const values = conversionData.map(item => item[valueKey] || 0);
    const maxValue = Math.max(...values, 0);
    const avgValue = values.reduce((sum, val) => sum + val, 0) / (values.length || 1);
    const maxIndex = values.indexOf(maxValue);
    const maxPeriod = conversionData[maxIndex]?.period || "N/A";
    const growthValue = values.length > 1 && values[0] > 0 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;

    return {
      bestPerformer: `${maxPeriod} shows highest performance (${maxValue} ${metricType})`,
      growthTrend: `${growthValue >= 0 ? '+' : ''}${growthValue.toFixed(1)}% growth in current view`,
      avgPerformance: `Average: ${avgValue.toFixed(1)} ${metricType} per period`,
    };
  }, [conversionData, metricType]);

  // Render Zero-Dummy-Data Empty State if no real data is found
  if (!hasRealData) {
    return (
      <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 text-center shadow-lg select-none">
        <BarChart3 className="w-14 h-14 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
        <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">No Performance History</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 max-w-md mx-auto">
          No daily report logs are present in the database to build historical analytics or trend comparisons. Real logs will automatically render here once staff submit their reports.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={cn("space-y-6", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-3">
            <Target className="w-6 h-6 text-[#FA4615]" />
            Performance Comparison Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Daily, Weekly, and Monthly conversion & lead quality trends for strategic decision-making
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-zinc-800 rounded-full select-none">
          <Award className="w-4 h-4 text-indigo-600 dark:text-purple-400" />
          <span className="text-xs font-semibold text-indigo-600 dark:text-purple-400">CEO Insights</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Conversions / Leads Trend Area Chart */}
        <motion.div
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm lg:col-span-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Performance Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">View conversions and leads by time period</p>
            
            {/* Toggle Conversion/Leads */}
            <div className="flex items-center gap-2 mb-4 select-none">
              <button
                onClick={() => setMetricType('conversions')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  metricType === 'conversions'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200'
                }`}
              >
                Conversions
              </button>
              <button
                onClick={() => setMetricType('leads')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  metricType === 'leads'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200'
                }`}
              >
                Leads
              </button>
            </div>
            
            {/* Period Switchers */}
            <div className="flex items-center gap-2 select-none">
              <button
                onClick={() => setTimePeriod('daily')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timePeriod === 'daily'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setTimePeriod('weekly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timePeriod === 'weekly'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setTimePeriod('monthly')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timePeriod === 'monthly'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <defs>
                  <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricType === 'leads' ? '#6366f1' : (timePeriod === 'daily' ? '#3b82f6' : timePeriod === 'weekly' ? '#8b5cf6' : '#10b981')} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={metricType === 'leads' ? '#6366f1' : (timePeriod === 'daily' ? '#3b82f6' : timePeriod === 'weekly' ? '#8b5cf6' : '#10b981')} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-40" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  name={metricType}
                  dataKey={metricType}
                  stroke={metricType === 'leads' ? '#6366f1' : (timePeriod === 'daily' ? COLORS.daily : timePeriod === 'weekly' ? COLORS.weekly : COLORS.monthly)}
                  strokeWidth={2}
                  fill="url(#conversionGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {insights && (
            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-slate-100 dark:border-zinc-800">
              <p className="text-xs font-bold text-gray-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">📊 Real Data Insights:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-zinc-400">
                <div>• {insights.bestPerformer}</div>
                <div>• {insights.growthTrend}</div>
                <div>• {insights.avgPerformance}</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Lead Quality Trend Chart */}
        <motion.div
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Lead Quality Trends</h3>
              <p className="text-xs text-gray-600 dark:text-zinc-400 mb-4">Quality scores across time periods</p>
              
              <div className="flex items-center gap-2 select-none">
                <button
                  onClick={() => setQualityTimePeriod('daily')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    qualityTimePeriod === 'daily'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setQualityTimePeriod('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    qualityTimePeriod === 'weekly'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setQualityTimePeriod('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    qualityTimePeriod === 'monthly'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-zinc-800 rounded-lg flex-shrink-0">
              <Star className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qualityData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-40" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  domain={[0, 10]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  name="quality"
                  dataKey="quality"
                  stroke={COLORS.quality}
                  strokeWidth={2}
                  fill="url(#qualityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Staff performance Bar chart */}
        <motion.div
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Staff Performance</h3>
              <p className="text-xs text-gray-600 dark:text-zinc-400 mb-4">Leads generated by each staff member</p>
            </div>
            <div className="p-2 bg-green-50 dark:bg-zinc-800 rounded-lg flex-shrink-0">
              <Award className="w-4 h-4 text-green-600" />
            </div>
          </div>

          <div className="h-64">
            {realStaffData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500">No staff data submitted today</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realStaffData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="staffBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="opacity-40" />
                  <XAxis
                    dataKey="staff"
                    tick={{ fontSize: 9, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="leads"
                    name="Leads Claimed"
                    fill="url(#staffBarGradient)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}

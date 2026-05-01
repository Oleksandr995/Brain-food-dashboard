'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type CohortRow = {
  date: string;
  users: number;
  day1: number;
  day7: number;
  day30: number;
};

export default function Home() {
  const [stats, setStats] = useState({
    total: 0,
    appOpen: 0,
    addFood: 0,
    scanned: 0,
    recipes: 0,
    recipeViews: 0,
    ads: 0,
    paywall: 0,

    // funnel
    scanToRecipe: 0,
    recipeToView: 0,
    viewToAd: 0,

    // revenue
    revenue: 0,
    arpu: 0,
    paywallToAd: 0,
    adRevenue: 0,
    subscriptionRevenue: 0,
    oneTimeRevenue: 0,

    // subs tracking
    subsStarted: 0,
    subsRenewed: 0,
    oneTimePurchases: 0,
    subsCanceled: 0,
    conversionRate: 0,
    // users
    uniqueUsers: 0,
    returningUsers: 0,
    retention: 0,
    foodSaved: 0,
    recipesSaved: 0,
  });

  const [dailyData, setDailyData] = useState<any[]>([]);
  const [cohortData, setCohortData] = useState<CohortRow[]>([]);

  useEffect(() => {
    loadData();
    subscribe();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from('analytics_events')
      .select('event, created_at, user_id');

    if (!data) return;

    // ===== EVENTS =====
    const scans = data.filter(e => e.event === 'product_scanned').length;
    const recipeGenerated = data.filter(e => e.event === 'recipe_generated').length;
    const recipeViews = data.filter(e => e.event === 'recipe_view').length;
    const ads = data.filter(e => e.event === 'ad_watched').length;
    const paywall = data.filter(e => e.event === 'recipe_blocked').length;

    // ===== MONETIZATION EVENTS =====
    const subsStarted = data.filter(e => e.event === 'subscription_started').length;
    const subsRenewed = data.filter(e => e.event === 'subscription_renewed').length;
    const oneTimePurchases = data.filter(e => e.event === 'purchase_one_time').length;
    const subsCanceled = data.filter(e => e.event === 'subscription_canceled').length;
    const appOpen = data.filter(e => e.event === 'app_open').length;
    const foodSaved = data.filter(e => e.event === 'food_saved').length;
    const recipesSaved = data.filter(e => e.event === 'recipe_saved').length;

    // ===== USER FILTER =====
    const validData = data.filter(e => e.user_id && e.user_id !== 'anonymous');

    const uniqueUsers = new Set(validData.map(e => e.user_id)).size;

    // ===== USER DAYS =====
    const userDays: Record<string, Set<string>> = {};

    validData.forEach((e) => {
      const date = new Date(e.created_at).toISOString().slice(0, 10);

      if (!userDays[e.user_id]) {
        userDays[e.user_id] = new Set();
      }

      userDays[e.user_id].add(date);
    });

    const returningUsers = Object.values(userDays).filter(
      (days) => days.size > 1
    ).length;

    const retention = uniqueUsers > 0
      ? Number(((returningUsers / uniqueUsers) * 100).toFixed(1))
      : 0;

    // ===== FUNNEL =====
    const scanToRecipe = scans > 0 ? Number((recipeGenerated / scans * 100).toFixed(1)) : 0;
    const recipeToView = recipeGenerated > 0 ? Number((recipeViews / recipeGenerated * 100).toFixed(1)) : 0;
    const viewToAd = recipeViews > 0 ? Number((ads / recipeViews * 100).toFixed(1)) : 0;

    // ===== REVENUE =====

    // Ads
    const revenuePerAd = 0.03;
    const adRevenue = ads * revenuePerAd;

    // Subs
    const priceMonthly = 4.99;
    const oneTimePrice = 2.99;

    const subscriptionRevenue =
      (subsStarted + subsRenewed) * priceMonthly;

    const oneTimeRevenue =
      oneTimePurchases * oneTimePrice;
    const conversionRate = recipeViews > 0
      ? Number((subsStarted / recipeViews * 100).toFixed(1))
      : 0;

    // TOTAL
    const revenue = adRevenue + subscriptionRevenue + oneTimeRevenue;

    const arpu = uniqueUsers > 0
      ? Number((revenue / uniqueUsers).toFixed(2))
      : 0;

    // ===== COHORT TABLE =====
    const cohorts: Record<string, string[]> = {};

    Object.entries(userDays).forEach(([userId, days]) => {
      const firstDay = Array.from(days).sort()[0];

      if (!cohorts[firstDay]) {
        cohorts[firstDay] = [];
      }

      cohorts[firstDay].push(userId);
    });

    const cohortTable = Object.entries(cohorts).map(([date, users]) => {
      let d1 = 0, d7 = 0, d30 = 0;

      users.forEach((userId) => {
        const days = userDays[userId];
        const first = new Date(date);

        days.forEach((d) => {
          const diff = Math.floor(
            (new Date(d).getTime() - first.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diff === 1) d1++;
          if (diff === 7) d7++;
          if (diff === 30) d30++;
        });
      });

      const base = users.length;

      return {
        date,
        users: base,
        day1: base ? Number((d1 / base * 100).toFixed(1)) : 0,
        day7: base ? Number((d7 / base * 100).toFixed(1)) : 0,
        day30: base ? Number((d30 / base * 100).toFixed(1)) : 0,
      };
    });

    setCohortData(cohortTable);

    // ===== DAILY =====
    const grouped: Record<string, number> = {};

    data.forEach((e) => {
      const date = new Date(e.created_at).toISOString().slice(0, 10);
      grouped[date] = (grouped[date] || 0) + 1;
    });

    const chartData = Object.entries(grouped).map(([date, count]) => ({
      date,
      count,
    }));

    setDailyData(chartData);

    // ===== FINAL =====
    setStats({
      total: data.length,
      appOpen: data.filter(e => e.event === 'app_open').length,
      addFood: data.filter(e => e.event === 'add_food').length,
      scanned: scans,
      recipes: recipeGenerated,
      recipeViews,
      ads,
      paywall,

      scanToRecipe,
      recipeToView,
      viewToAd,

      revenue,
      arpu,
      paywallToAd: paywall > 0 ? Number((ads / paywall * 100).toFixed(1)) : 0,

      uniqueUsers,
      returningUsers,
      retention,
      adRevenue,
      subscriptionRevenue,
      oneTimeRevenue,
      subsStarted,
      subsRenewed,
      oneTimePurchases,
      subsCanceled,
      conversionRate,
      foodSaved,
      recipesSaved,
    });
  }
  async function resetData() {
    const confirmReset = confirm("⚠️ Reset all analytics data?");

    if (!confirmReset) return;

    const RESET_DATE = "2026-05-01"; // später dein echtes Launch Datum

    await supabase
      .from('analytics_events')
      .delete()
      .gte('created_at', RESET_DATE);

    alert("✅ Data reset complete");

    loadData();
  }
  function subscribe() {
    supabase
      .channel('realtime-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'analytics_events' },
        loadData
      )
      .subscribe();
  }

  // 🎨 COLORS
  const getColor = (value: number) => {
    if (value > 40) return '#22c55e';   // green
    if (value > 20) return '#f59e0b';   // orange
    if (value > 10) return '#f97316';   // darker orange
    return '#ef4444';                   // red
  };

  return (
    <div style={{ padding: 24, background: '#0b0b0b', minHeight: '100vh', color: 'white' }}>

      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
      }}>
        <h1 style={{ fontSize: 28 }}>🚀 Founder Dashboard</h1>

        <button
          onClick={resetData}
          style={{
            background: '#ff4444',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          🔥 Reset
        </button>
      </div>

      {/* KPI SECTION */}
      <Section title="📊 Core Metrics">
        <Card title="Users" value={stats.uniqueUsers} />
        <Card title="Returning" value={stats.returningUsers} />
        <Card title="Retention" value={`${stats.retention}%`} />
        <Card title="ARPU" value={`${stats.arpu} €`} />
        <Card title="🚀 App Opens" value={stats.appOpen} />
        <Card title="📦 Food Saved" value={stats.foodSaved} />
        <Card title="🍳 Recipes Saved" value={stats.recipesSaved} />
        <Card title="📦 Scans" value={stats.scanned} />
      </Section>

      {/* ===== REVENUE ===== */}
      <Section title="💰 Revenue">
        <Card title="Total Revenue" value={`${stats.revenue.toFixed(2)} €`} highlight />
        <Card title="Ads" value={`${stats.adRevenue?.toFixed(2) ?? 0} €`} />
        <Card title="Subscriptions" value={`${stats.subscriptionRevenue?.toFixed(2) ?? 0} €`} />
        <Card title="One-time" value={`${stats.oneTimeRevenue?.toFixed(2) ?? 0} €`} />
      </Section>

      {/* ===== SUBS ===== */}
      <Section title="🔥 Monetization">
        <Card title="Started" value={stats.subsStarted} />
        <Card title="Renewed" value={stats.subsRenewed} />
        <Card title="One-time Buys" value={stats.oneTimePurchases} />
        <Card title="Conversion" value={`${stats.conversionRate}%`} highlight />
      </Section>

      {/* ===== FUNNEL ===== */}
      <Section title="⚡ Funnel">
        <Card title="Scan → Recipe" value={`${stats.scanToRecipe}%`} />
        <Card title="Recipe → View" value={`${stats.recipeToView}%`} />
        <Card title="View → Ad" value={`${stats.viewToAd}%`} />
      </Section>

      {/* ===== COHORT ===== */}
      <h2 style={{ marginTop: 40 }}>🔥 Cohort Retention</h2>

      <div style={{
        marginTop: 12,
        overflowX: 'auto',
        background: '#111',
        borderRadius: 12,
        padding: 12
      }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr style={{ opacity: 0.6 }}>
              <th>Date</th>
              <th>Users</th>
              <th>D1</th>
              <th>D7</th>
              <th>D30</th>
            </tr>
          </thead>

          <tbody>
            {cohortData.map((row, i) => (
              <tr key={i}>
                <td>{row.date}</td>
                <td>{row.users}</td>

                <td style={{ color: getColor(row.day1) }}>{row.day1}%</td>
                <td style={{ color: getColor(row.day7) }}>{row.day7}%</td>
                <td style={{ color: getColor(row.day30) }}>{row.day30}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== CHART ===== */}
      <div style={{ marginTop: 40, height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#ff6600" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div >
  );
}

function Card({ title, value, highlight }: any) {
  return (
    <div style={{
      background: highlight
        ? 'linear-gradient(135deg, #ff6600, #ff9900)'
        : '#111',
      padding: 20,
      borderRadius: 14,
      minWidth: 180,
      boxShadow: highlight
        ? '0 0 20px rgba(255,102,0,0.4)'
        : '0 0 10px rgba(0,0,0,0.3)'
    }}>
      <div style={{ opacity: 0.6, fontSize: 14 }}>{title}</div>

      <div style={{
        fontSize: 26,
        fontWeight: 'bold',
        marginTop: 8
      }}>
        {value}
      </div>
    </div>
  );
}
function Section({ title, children }: any) {
  return (
    <>
      <h2 style={{ marginTop: 30 }}>{title}</h2>

      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        marginTop: 10
      }}>
        {children}
      </div>
    </>
  );
}
function HeatCell({ value }: { value: number }) {
  const getBg = (v: number) => {
    if (v > 40) return '#065f46'; // strong green
    if (v > 25) return '#047857';
    if (v > 15) return '#059669';
    if (v > 8) return '#f59e0b';
    if (v > 3) return '#ea580c';
    return '#7f1d1d';
  };

  return (
    <td
      style={{
        background: getBg(value),
        padding: '6px 10px',
        borderRadius: 6,
        textAlign: 'center',
        fontWeight: 600,
        transition: '0.2s',
        cursor: 'default',
      }}
      title={`${value}% retention`}
    >
      {value}%
    </td>
  );
}
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>RxGrowth | Restaurant OS</title>
<meta name="description" content="Restaurant performance and customer intelligence dashboard.">
<meta name="theme-color" content="#070B14">

<link rel="icon" type="image/png" href="https://assets.cdn.filesafe.space/A0gpQEZUjXc6m3mzsCUH/media/6ac43aa9bbad531ac8d905d4.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
:root {
  --bg: #070B14;
  --sidebar: #090D18;
  --card: #101827;
  --card2: #0D1523;
  --border: #243247;
  --primary: #5DEFFF;
  --text: #F5F9FF;
  --muted: #A9B8CC;
  --green: #4ADE80;
  --yellow: #FBBF24;
  --red: #FB7185;
  --purple: #A5B4FC;
  --sidebar-width: 250px;
}

* { box-sizing: border-box; }

html {
  min-height: 100%;
  background: var(--bg);
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button, select { font: inherit; }
button { cursor: pointer; }

button:focus-visible,
select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

/* =====================================================
   SIDEBAR
===================================================== */

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);
  background: var(--sidebar);
  border-right: 1px solid #1B2738;
  display: flex;
  flex-direction: column;
  z-index: 30;
}

.brand {
  height: 72px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1B2738;
  flex-shrink: 0;
  overflow: hidden;
}

.brand-logo {
  display: block;
  width: 100%;
  max-width: 195px;
  max-height: 46px;
  object-fit: contain;
  object-position: left center;
}

.nav {
  padding: 13px 10px 14px;
  overflow-y: auto;
  flex: 1;
}

.nav-group { margin-top: 8px; }

.group-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: 0;
  color: #9AAAC0;
  padding: 10px 9px 7px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.15px;
  text-align: left;
}

.chev { font-size: 12px; transition: transform .15s; }

.nav-group.collapsed .chev { transform: rotate(-90deg); }
.nav-group.collapsed .group-items { display: none; }

.group-items { display: grid; gap: 3px; }

.nav-item {
  width: 100%;
  min-height: 36px;
  border: 1px solid transparent;
  background: transparent;
  color: #AEBBD0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  text-align: left;
  transition: background .15s, color .15s, border-color .15s;
}

.nav-item:hover {
  background: #111B2A;
  color: #F5F9FF;
}

.nav-item.active {
  background: rgba(93,239,255,.085);
  border-color: rgba(93,239,255,.23);
  color: var(--primary);
}

.nav-icon {
  width: 17px;
  text-align: center;
  font-size: 14px;
  flex-shrink: 0;
}

.nav-text {
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.badge {
  font-size: 9px;
  font-weight: 600;
  color: #B2C0D2;
  background: #172233;
  padding: 4px 6px;
  border-radius: 5px;
  white-space: nowrap;
}

.badge.live {
  color: var(--green);
  background: rgba(74,222,128,.09);
}

.sidebar-bottom {
  padding: 12px;
  border-top: 1px solid #1B2738;
  flex-shrink: 0;
  background: var(--sidebar);
}

.connection {
  background: var(--card);
  border: 1px solid var(--border);
  padding: 11px;
  border-radius: 9px;
}

.connection-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  color: #E7EDF6;
}

.dot {
  width: 7px;
  height: 7px;
  background: var(--yellow);
  border-radius: 50%;
  flex-shrink: 0;
}

.connection-text {
  color: #A9B8CC;
  font-size: 10px;
  line-height: 1.65;
  margin-top: 7px;
}

/* =====================================================
   MAIN / AMBIENT GRADIENT
===================================================== */

.main {
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  position: relative;
  isolation: isolate;
}

.main::before {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
  top: 0;
  left: 0;
  right: 0;
  height: 650px;
  background:
    radial-gradient(
      ellipse at 65% 0%,
      rgba(25,176,194,.105) 0%,
      rgba(20,123,145,.055) 30%,
      rgba(7,11,20,0) 72%
    ),
    linear-gradient(
      180deg,
      rgba(12,29,42,.20) 0%,
      rgba(7,11,20,0) 100%
    );
}

.topbar {
  min-height: 66px;
  border-bottom: 1px solid #1B2738;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 29px;
  gap: 14px;
  background: rgba(7,11,20,.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  position: relative;
  z-index: 5;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.date-control {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  background: rgba(16,24,39,.92);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #AEBBD0;
  font-size: 11px;
}

.date-control select {
  background: transparent;
  color: var(--text);
  border: 0;
  outline: 0;
  max-width: 130px;
  font-size: 11px;
}

.date-control option { background: var(--card); }

.icon-button {
  width: 35px;
  height: 35px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: #C1CDDC;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.icon-button:hover {
  color: var(--primary);
  border-color: #397A86;
}

.profile {
  width: 39px;
  height: 39px;
  padding: 5px;
  border-radius: 10px;
  background: rgba(16,24,39,.8);
  border: 1px solid #26384B;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.profile img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mobile-menu,
.overlay { display: none; }

/* =====================================================
   PAGE HEADER
===================================================== */

.content {
  max-width: 1650px;
  padding: 29px 29px 36px;
  margin: auto;
  position: relative;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 26px;
}

.page-heading-copy { min-width: 0; }

.page-title {
  font-size: 29px;
  font-weight: 700;
  letter-spacing: -1.1px;
  line-height: 1.2;
  margin: 0;
  color: #F8FAFF;
}

.description {
  color: #B0BED1;
  font-size: 13px;
  line-height: 1.65;
  margin: 8px 0 0;
}

.heading-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
  flex-shrink: 0;
}

.updated {
  color: #A2B0C3;
  font-size: 10px;
  line-height: 1.5;
  text-align: right;
}

.updated strong {
  color: #E0E8F2;
  font-weight: 500;
}

.primary {
  border: 1px solid rgba(93,239,255,.30);
  background: rgba(93,239,255,.085);
  color: var(--primary);
  padding: 10px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: background .15s, border-color .15s;
}

.primary:hover {
  background: rgba(93,239,255,.14);
  border-color: rgba(93,239,255,.48);
}

.primary:disabled,
.icon-button:disabled {
  opacity: .6;
  cursor: wait;
}

.state {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin: 15px 0;
  color: #B3C0D1;
  font-size: 12px;
  line-height: 1.8;
}

.state.error {
  border-color: rgba(251,113,133,.32);
  color: #FDA4AF;
}

.state[hidden],
.page[hidden] {
  display: none !important;
}

/* =====================================================
   SECTION HEADINGS
===================================================== */

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 27px 0 13px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #F1F5FB;
}

.caption {
  font-size: 11px;
  color: #A9B8CC;
  margin-top: 5px;
  line-height: 1.5;
}

.tag {
  color: var(--primary);
  font-size: 9px;
  font-weight: 600;
  padding: 6px 8px;
  border-radius: 5px;
  background: rgba(93,239,255,.065);
  border: 1px solid rgba(93,239,255,.14);
  letter-spacing: .45px;
  white-space: nowrap;
}

/* =====================================================
   METRIC CARDS
===================================================== */

.metrics {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 12px;
}

.metric {
  min-width: 0;
  background: rgba(16,24,39,.94);
  border: 1px solid #27364B;
  border-radius: 11px;
  padding: 17px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,.07);
}

.metric:before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: var(--accent,var(--primary));
  opacity: .85;
}

.metric-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-label {
  color: #B7C4D6;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.55;
}

.metric-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--accent,var(--primary));
  background: var(--icon-bg,rgba(93,239,255,.08));
  flex-shrink: 0;
  font-size: 13px;
}

.metric-value {
  margin-top: 18px;
  font-size: clamp(23px,2vw,30px);
  font-weight: 700;
  letter-spacing: -.8px;
  line-height: 1.2;
  overflow-wrap: anywhere;
  color: #F7FAFF;
  font-variant-numeric: tabular-nums;
}

.metric-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  color: #A8B6C9;
  font-size: 10px;
  line-height: 1.55;
}

.foot-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent,var(--primary));
  flex-shrink: 0;
}

/* =====================================================
   CHARTS / PANELS
===================================================== */

.charts {
  display: grid;
  grid-template-columns: minmax(0,1.2fr) minmax(0,.8fr);
  gap: 12px;
}

.panel {
  background: rgba(16,24,39,.95);
  border: 1px solid #27364B;
  border-radius: 11px;
  min-width: 0;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,.055);
}

.panel-head {
  padding: 16px 17px 13px;
  border-bottom: 1px solid rgba(148,163,184,.11);
}

.panel-title {
  font-size: 12px;
  font-weight: 700;
  color: #F0F5FC;
}

.panel-sub {
  font-size: 10px;
  color: #A9B8CC;
  line-height: 1.65;
  margin-top: 5px;
}

.panel-body { padding: 16px; }

.chart {
  position: relative;
  width: 100%;
  height: 220px;
}

.chart.small { height: 205px; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 13px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #B0BED1;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* =====================================================
   CUSTOMER INSIGHTS
===================================================== */

.insights {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 9px;
}

.insight {
  padding: 14px;
  border-radius: 8px;
  background: var(--card2);
  border: 1px solid var(--border);
}

.insight-label {
  color: #AEBBD0;
  font-size: 10px;
  line-height: 1.5;
}

.insight-value {
  font-size: 21px;
  font-weight: 700;
  margin-top: 9px;
  color: #F5F9FF;
  font-variant-numeric: tabular-nums;
}

/* =====================================================
   NOTICE / FOOTER
===================================================== */

.notice {
  display: flex;
  gap: 10px;
  background: rgba(251,191,36,.035);
  border: 1px solid rgba(251,191,36,.15);
  border-radius: 9px;
  padding: 13px 15px;
  margin-top: 20px;
}

.notice-icon {
  color: var(--yellow);
  flex-shrink: 0;
  font-size: 13px;
}

.notice-title {
  color: #FDE68A;
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 5px;
}

.notice-text {
  color: #B4B3B4;
  font-size: 10px;
  line-height: 1.75;
}

.footer {
  border-top: 1px solid #1B2738;
  margin-top: 27px;
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #8998AD;
  font-size: 10px;
}

.footer strong { color: #E0E8F2; }

/* =====================================================
   PLANNED MODULES
===================================================== */

.placeholder {
  border: 1px solid var(--border);
  background: rgba(16,24,39,.94);
  border-radius: 11px;
  padding: 27px;
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.placeholder-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(93,239,255,.08);
  color: var(--primary);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 17px;
}

.placeholder h2 {
  font-size: 16px;
  margin: 2px 0 9px;
  color: #F5F9FF;
}

.placeholder p {
  font-size: 12px;
  color: #B0BED1;
  line-height: 1.8;
  margin: 0;
  max-width: 650px;
}

.planned {
  display: inline-flex;
  margin-top: 13px;
  padding: 6px 9px;
  border-radius: 5px;
  font-size: 10px;
  color: var(--yellow);
  background: rgba(251,191,36,.07);
  border: 1px solid rgba(251,191,36,.15);
}

.loading {
  color: #91A0B5;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  50% { opacity: .55; }
}

/* =====================================================
   RESPONSIVE
===================================================== */

@media(max-width:1200px) {
  .metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .content { padding-left: 22px; padding-right: 22px; }
  .topbar { padding: 0 22px; }
}

@media(max-width:850px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform .2s ease;
  }

  .sidebar.open { transform: translateX(0); }

  .overlay.open {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.65);
    z-index: 20;
  }

  .main { margin-left: 0; }
  .mobile-menu { display: grid; }
  .charts { grid-template-columns: 1fr; }

  .topbar { min-height: 64px; }
  .content { padding-top: 25px; }
}

@media(max-width:560px) {
  .topbar { padding: 0 12px; gap: 7px; }
  .topbar-left { gap: 7px; }
  .top-right { gap: 5px; }

  .date-control {
    padding: 8px 7px;
    gap: 5px;
    font-size: 10px;
  }

  .date-control select {
    max-width: 84px;
    font-size: 10px;
  }

  .profile {
    width: 33px;
    height: 33px;
    padding: 3px;
  }

  .content { padding: 22px 12px 27px; }
  .page-title { font-size: 27px; }
  .description { font-size: 12px; }

  .heading-actions { gap: 7px; }

  .updated {
    font-size: 9px;
    max-width: 155px;
  }

  .primary {
    padding: 9px 10px;
    font-size: 10px;
  }

  .metrics { gap: 8px; }
  .metric { padding: 12px; }
  .metric-label { font-size: 10px; }

  .metric-icon {
    width: 25px;
    height: 25px;
  }

  .metric-value {
    font-size: 21px;
    margin-top: 14px;
  }

  .metric-foot {
    font-size: 9px;
    align-items: flex-start;
  }

  .section-title { font-size: 12px; }
  .caption { font-size: 10px; }
  .panel-head { padding: 13px; }
  .panel-body { padding: 12px; }
  .chart { height: 200px; }
  .chart.small { height: 190px; }

  .insights { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .insight { padding: 11px; }
  .insight-label { font-size: 9px; }
  .insight-value { font-size: 19px; }

  .notice { padding: 11px; }
  .notice-text { font-size: 9px; }
  .footer { flex-direction: column; }
  .placeholder { padding: 18px; }
}

@media(max-width:380px) {
  .brand { padding-left: 15px; }

  .date-control > span { display: none; }
  .date-control select { max-width: 80px; }

  .page-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .heading-actions { align-items: flex-start; }

  .updated {
    max-width: none;
    text-align: left;
  }

  .insights { grid-template-columns: 1fr; }
}

@media(prefers-reduced-motion:reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
</head>

<body>

<div class="overlay" id="overlay"></div>

<aside class="sidebar" id="sidebar">

  <!-- PRIMARY BRAND LOGO -->
<div class="brand">
  <img
    class="brand-logo"
    src="https://assets.cdn.filesafe.space/A0gpQEZUjXc6m3mzsCUH/media/6acbf9a8bbad531ac895c5e5.png"
    alt="RxGrowth Restaurant OS">
</div>

  <nav class="nav" aria-label="Main navigation">

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>OVERVIEW</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item active" type="button" data-page="overview">
          <span class="nav-icon">◫</span>
          <span class="nav-text">Overview</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>ORDERS & OPERATIONS</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="orders">
          <span class="nav-icon">▤</span>
          <span class="nav-text">Orders</span>
          <span class="badge live">V1</span>
        </button>
        <button class="nav-item" type="button" data-page="abandoned">
          <span class="nav-icon">◷</span>
          <span class="nav-text">Abandoned Checkouts</span>
          <span class="badge">Planned</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>CUSTOMERS</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="customers">
          <span class="nav-icon">♧</span>
          <span class="nav-text">Customer Analytics</span>
          <span class="badge live">V1</span>
        </button>
        <button class="nav-item" type="button" data-page="segments">
          <span class="nav-icon">◎</span>
          <span class="nav-text">Customer Segments</span>
          <span class="badge">Planned</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>CAMPAIGNS & QR</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="birthday">
          <span class="nav-icon">✳</span>
          <span class="nav-text">Birthday</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="winback">
          <span class="nav-icon">↻</span>
          <span class="nav-text">Win-Back</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="slowtime">
          <span class="nav-icon">◷</span>
          <span class="nav-text">Slow-Time</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="qr">
          <span class="nav-icon">▦</span>
          <span class="nav-text">QR Ecosystem</span>
          <span class="badge">Planned</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>RETENTION & LOYALTY</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="retention">
          <span class="nav-icon">⟳</span>
          <span class="nav-text">Retention</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="loyalty">
          <span class="nav-icon">☆</span>
          <span class="nav-text">Loyalty & Rewards</span>
          <span class="badge">Planned</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>REVIEWS & REPUTATION</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="reviews">
          <span class="nav-icon">☆</span>
          <span class="nav-text">Reviews Overview</span>
          <span class="badge">Planned</span>
        </button>
      </div>
    </div>

    <div class="nav-group">
      <button class="group-toggle" type="button" aria-expanded="true">
        <span>MANAGEMENT</span><span class="chev">⌄</span>
      </button>
      <div class="group-items">
        <button class="nav-item" type="button" data-page="attention">
          <span class="nav-icon">!</span>
          <span class="nav-text">Needs Attention</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="reports">
          <span class="nav-icon">▥</span>
          <span class="nav-text">Reports</span>
          <span class="badge">Planned</span>
        </button>
        <button class="nav-item" type="button" data-page="settings">
          <span class="nav-icon">⚙</span>
          <span class="nav-text">Settings</span>
        </button>
      </div>
    </div>

  </nav>

  <div class="sidebar-bottom">
    <div class="connection">
      <div class="connection-heading">
        <span class="dot" id="connectionDot"></span>
        <span id="connectionText">Connecting to HighLevel</span>
      </div>
      <div class="connection-text" id="connectionDetails">
        Checking dashboard data source…
      </div>
    </div>
  </div>

</aside>

<main class="main">

  <header class="topbar">

    <div class="topbar-left">
      <button
        id="mobileMenu"
        class="icon-button mobile-menu"
        type="button"
        aria-label="Open navigation">☰</button>
    </div>

    <div class="top-right">

      <label class="date-control">
        <span>Period</span>
        <select id="period" aria-label="Reporting period">
          <option value="today" selected>Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </label>

      <button
        id="refresh"
        class="icon-button"
        type="button"
        aria-label="Refresh dashboard"
        title="Refresh dashboard">↻</button>

      <!-- SECONDARY LOGO -->
      <div class="profile" title="RxGrowth">
        <img
          src="https://assets.cdn.filesafe.space/A0gpQEZUjXc6m3mzsCUH/media/6ac43aa9bbad531ac8d905d4.png"
          alt="RxGrowth icon">
      </div>

    </div>
  </header>

  <div class="content">

    <div class="page-heading">

      <div class="page-heading-copy">
        <h1 class="page-title" id="pageTitle">Overview</h1>
        <p class="description" id="pageDescription">
          A clear view of today's restaurant performance.
        </p>
      </div>

      <div class="heading-actions">
        <div class="updated">
          Last updated
          <strong id="lastUpdated">Waiting for data…</strong>
        </div>

        <button id="refreshMain" class="primary" type="button">
          <span>↻</span> Refresh data
        </button>
      </div>

    </div>

    <div id="errorBox" class="state error" hidden>
      <strong id="errorTitle">Unable to load dashboard data.</strong>
      <div id="errorMessage" style="margin-top:5px">
        Please try again.
      </div>
    </div>

    <section id="overviewPage" class="page">

      <div class="metrics">

        <article class="metric" style="--accent:#5DEFFF">
          <div class="metric-top">
            <div class="metric-label">Recorded Order Value</div>
            <div class="metric-icon">¤</div>
          </div>
          <div class="metric-value loading" id="totalOrderValue">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Value recorded in HighLevel
          </div>
        </article>

        <article class="metric" style="--accent:#5DEFFF">
          <div class="metric-top">
            <div class="metric-label">Completed Orders</div>
            <div class="metric-icon">▤</div>
          </div>
          <div class="metric-value loading" id="totalOrders">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Completed orders in period
          </div>
        </article>

        <article class="metric" style="--accent:#A5B4FC;--icon-bg:rgba(165,180,252,.08)">
          <div class="metric-top">
            <div class="metric-label">Average Order Value</div>
            <div class="metric-icon">↗</div>
          </div>
          <div class="metric-value loading" id="averageOrderValue">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Recorded value ÷ completed orders
          </div>
        </article>

        <article class="metric" style="--accent:#4ADE80;--icon-bg:rgba(74,222,128,.08)">
          <div class="metric-top">
            <div class="metric-label">Active Customers</div>
            <div class="metric-icon">♧</div>
          </div>
          <div class="metric-value loading" id="activeCustomers">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Customers with a completed order
          </div>
        </article>

      </div>

      <div class="section-head">
        <div>
          <div class="section-title">Orders & Payments</div>
          <div class="caption">Payment status recorded in HighLevel.</div>
        </div>
        <span class="tag">ORDERS</span>
      </div>

      <div class="metrics">

        <article class="metric" style="--accent:#4ADE80;--icon-bg:rgba(74,222,128,.08)">
          <div class="metric-top">
            <div class="metric-label">Paid Orders</div>
            <div class="metric-icon">✓</div>
          </div>
          <div class="metric-value loading" id="paidOrders">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Recorded as paid
          </div>
        </article>

        <article class="metric" style="--accent:#FBBF24;--icon-bg:rgba(251,191,36,.08)">
          <div class="metric-top">
            <div class="metric-label">Unpaid Orders</div>
            <div class="metric-icon">◷</div>
          </div>
          <div class="metric-value loading" id="unpaidOrders">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Recorded as unpaid
          </div>
        </article>

        <article class="metric" style="--accent:#A5B4FC;--icon-bg:rgba(165,180,252,.08)">
          <div class="metric-top">
            <div class="metric-label">Returning Customers</div>
            <div class="metric-icon">↻</div>
          </div>
          <div class="metric-value loading" id="returningCustomers">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            Multiple orders in available history
          </div>
        </article>

        <article class="metric" style="--accent:#5DEFFF">
          <div class="metric-top">
            <div class="metric-label">Repeat Buyer Rate</div>
            <div class="metric-icon">%</div>
          </div>
          <div class="metric-value loading" id="repeatBuyerRate">—</div>
          <div class="metric-foot">
            <span class="foot-dot"></span>
            2+ orders in selected period
          </div>
        </article>

      </div>

      <div class="section-head">
        <div>
          <div class="section-title">Performance Breakdown</div>
          <div class="caption">Recorded order value and customer mix.</div>
        </div>
      </div>

      <div class="charts">

        <article class="panel">
          <div class="panel-head">
            <div class="panel-title">Order Value by Payment Status</div>
            <div class="panel-sub">
              Recorded value, not independently verified collections.
            </div>
          </div>
          <div class="panel-body">
            <div class="chart">
              <canvas id="paymentValueChart"></canvas>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div class="panel-title">Order Distribution</div>
            <div class="panel-sub">
              Completed orders grouped by recorded payment status.
            </div>
          </div>
          <div class="panel-body">
            <div class="chart small">
              <canvas id="paymentCountChart"></canvas>
            </div>
            <div class="legend">
              <div class="legend-item">
                <span class="legend-dot" style="background:#4ADE80"></span>
                Paid
              </div>
              <div class="legend-item">
                <span class="legend-dot" style="background:#FBBF24"></span>
                Unpaid
              </div>
              <div class="legend-item">
                <span class="legend-dot" style="background:#64748B"></span>
                Other status
              </div>
            </div>
          </div>
        </article>

      </div>

      <div class="section-head">
        <div>
          <div class="section-title">Customer Intelligence</div>
          <div class="caption">Customer activity and repeat purchasing behavior.</div>
        </div>
        <span class="tag">CUSTOMERS</span>
      </div>

      <div class="charts">

        <article class="panel">
          <div class="panel-head">
            <div class="panel-title">Customer Segmentation</div>
            <div class="panel-sub">
              New and returning customers in available order history.
            </div>
          </div>
          <div class="panel-body">
            <div class="chart small">
              <canvas id="customerChart"></canvas>
            </div>
            <div class="legend">
              <div class="legend-item">
                <span class="legend-dot" style="background:#5DEFFF"></span>
                New customers
              </div>
              <div class="legend-item">
                <span class="legend-dot" style="background:#A5B4FC"></span>
                Returning customers
              </div>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div class="panel-title">Customer Metrics</div>
            <div class="panel-sub">Key behavior indicators.</div>
          </div>
          <div class="panel-body insights">
            <div class="insight">
              <div class="insight-label">Returning Customer Rate</div>
              <div class="insight-value" id="returningCustomerRate">—</div>
            </div>
            <div class="insight">
              <div class="insight-label">Average Orders per Customer</div>
              <div class="insight-value" id="ordersPerCustomer">—</div>
            </div>
            <div class="insight">
              <div class="insight-label">New Customers</div>
              <div class="insight-value" id="newCustomers">—</div>
            </div>
            <div class="insight">
              <div class="insight-label">Other Payment Status</div>
              <div class="insight-value" id="otherPaymentStatus">—</div>
            </div>
          </div>
        </article>

      </div>

      <div class="notice">
        <div class="notice-icon">ⓘ</div>
        <div>
          <div class="notice-title">Data context</div>
          <div class="notice-text">
            Metrics are calculated from order records available in HighLevel.
            Order value does not independently verify payment collection.
            New and returning customer classifications depend on available
            order history. Real-time fulfillment, customer happiness, and
            test-order exclusion are not yet verified.
          </div>
        </div>
      </div>

    </section>

    <section id="placeholderPage" class="page" hidden>
      <div class="placeholder">
        <div class="placeholder-icon" id="placeholderIcon">◈</div>
        <div>
          <h2 id="placeholderTitle">Module planned</h2>
          <p id="placeholderDescription">
            This module will be enabled after its data source,
            calculation rules, and workflows are verified.
          </p>
          <span class="planned">PLANNED · NOT CONNECTED</span>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div><strong>RxGrowth</strong> · Restaurant OS</div>
      <div>Data source: HighLevel Payments Orders API</div>
    </footer>

  </div>
</main>

<script>
const $ = id => document.getElementById(id);

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 2
});

let charts = {
  value: null,
  count: null,
  customers: null
};

let controller = null;

const pages = {
  overview: [
    "Overview",
    "Overview",
    "Overview",
    "A clear view of today's restaurant performance.",
    "◫"
  ],
  orders: [
    "Orders",
    "Orders & Operations",
    "Orders",
    "Order records and payment status from HighLevel.",
    "▤"
  ],
  abandoned: [
    "Abandoned Checkouts",
    "Orders & Operations",
    "Abandoned Checkouts",
    "Checkout recovery will be available after checkout events are connected.",
    "◷"
  ],
  customers: [
    "Customer Analytics",
    "Customers",
    "Customers",
    "Customer activity and repeat purchasing behavior.",
    "♧"
  ],
  segments: [
    "Customer Segments",
    "Customers",
    "Customer Segments",
    "Lifecycle segments will be calculated from verified order history.",
    "◎"
  ],
  birthday: [
    "Birthday Campaign",
    "Campaigns & QR",
    "Birthday",
    "Birthday campaign performance and coupon attribution.",
    "✳"
  ],
  winback: [
    "Win-Back Campaign",
    "Campaigns & QR",
    "Win-Back",
    "Reactivation campaign performance and attributed orders.",
    "↻"
  ],
  slowtime: [
    "Slow-Time Campaign",
    "Campaigns & QR",
    "Slow-Time",
    "Slow-day offers, redemptions, and attributed order value.",
    "◷"
  ],
  qr: [
    "QR Ecosystem",
    "Campaigns & QR",
    "QR Ecosystem",
    "QR analytics will appear when a reliable analytics source is connected.",
    "▦"
  ],
  retention: [
    "Retention",
    "Retention & Loyalty",
    "Retention",
    "Retention trends and lapsed-customer analysis.",
    "⟳"
  ],
  loyalty: [
    "Loyalty & Rewards",
    "Retention & Loyalty",
    "Loyalty & Rewards",
    "Loyalty program activity and reward redemptions.",
    "☆"
  ],
  reviews: [
    "Reviews Overview",
    "Reviews & Reputation",
    "Reviews Overview",
    "Review trends and unanswered feedback from a verified source.",
    "☆"
  ],
  attention: [
    "Needs Attention",
    "Management",
    "Needs Attention",
    "Actionable alerts will appear when data sources and rules are verified.",
    "!"
  ],
  reports: [
    "Reports",
    "Management",
    "Reports",
    "Reporting and export tools will be added after core metrics are validated.",
    "▥"
  ],
  settings: [
    "Settings",
    "Settings",
    "Settings",
    "Restaurant connection and dashboard settings will be available here.",
    "⚙"
  ]
};

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? numberFormat.format(n) : "—";
}

function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? currencyFormat.format(n) : "—";
}

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${numberFormat.format(n)}%` : "—";
}

function localDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function getDateRange() {
  const selected = $("period").value;
  const end = new Date();
  const start = new Date(end);

  if (selected !== "today") {
    start.setDate(start.getDate() - (Number(selected) - 1));
  }

  return {
    startDate: localDateString(start),
    endDate: localDateString(end),
    label: selected === "today" ? "Today" : `Last ${selected} days`
  };
}

function setConnection(connected, title, details) {
  $("connectionDot").style.background =
    connected ? "#4ADE80" : "#FB7185";

  $("connectionText").textContent = title;
  $("connectionDetails").textContent = details;
}

function showError(message, title = "Unable to load dashboard data.") {
  $("errorBox").hidden = false;
  $("errorTitle").textContent = title;
  $("errorMessage").textContent = message;
}

function clearError() {
  $("errorBox").hidden = true;
  $("errorMessage").textContent = "";
}

function setLoading(isLoading) {
  [$("refresh"), $("refreshMain")].forEach(button => {
    button.disabled = isLoading;
  });

  $("refresh").textContent = isLoading ? "…" : "↻";

  $("refreshMain").innerHTML = isLoading
    ? "<span>…</span> Loading data"
    : "<span>↻</span> Refresh data";
}

function removeLoadingStyles() {
  document.querySelectorAll(".metric-value").forEach(element => {
    element.classList.remove("loading");
  });
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 180 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#101827",
        borderColor: "#243247",
        borderWidth: 1,
        titleColor: "#F5F9FF",
        bodyColor: "#CBD5E1",
        padding: 10,
        displayColors: true
      }
    }
  };
}

function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });

  charts = { value: null, count: null, customers: null };
}

function renderCharts(data) {
  if (typeof Chart === "undefined") {
    throw new Error("Chart library could not be loaded.");
  }

  destroyCharts();

  const orders = data.orders;
  const values = data.orderValue;
  const customers = data.customers;

  Chart.defaults.color = "#A9B8CC";
  Chart.defaults.font.family = "Inter, sans-serif";

  charts.value = new Chart($("paymentValueChart"), {
    type: "bar",
    data: {
      labels: ["Paid", "Unpaid"],
      datasets: [{
        label: "Recorded order value",
        data: [
          Number(values.paid) || 0,
          Number(values.unpaid) || 0
        ],
        backgroundColor: [
          "rgba(74,222,128,.78)",
          "rgba(251,191,36,.78)"
        ],
        borderRadius: 5,
        maxBarThickness: 54
      }]
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: {
          grid: { display: false },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(148,163,184,.09)" },
          border: { display: false },
          ticks: {
            callback: value => numberFormat.format(value)
          }
        }
      },
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: context => formatMoney(context.raw)
          }
        }
      }
    }
  });

  charts.count = new Chart($("paymentCountChart"), {
    type: "doughnut",
    data: {
      labels: ["Paid", "Unpaid", "Other status"],
      datasets: [{
        data: [
          Number(orders.paid) || 0,
          Number(orders.unpaid) || 0,
          Number(orders.otherPaymentStatus) || 0
        ],
        backgroundColor: ["#4ADE80", "#FBBF24", "#64748B"],
        borderColor: "#101827",
        borderWidth: 4,
        hoverOffset: 3
      }]
    },
    options: {
      ...chartDefaults(),
      cutout: "73%",
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: context =>
              `${context.label}: ${formatNumber(context.raw)}`
          }
        }
      }
    }
  });

  charts.customers = new Chart($("customerChart"), {
    type: "doughnut",
    data: {
      labels: ["New customers", "Returning customers"],
      datasets: [{
        data: [
          Number(customers.new) || 0,
          Number(customers.returning) || 0
        ],
        backgroundColor: ["#5DEFFF", "#A5B4FC"],
        borderColor: "#101827",
        borderWidth: 4,
        hoverOffset: 3
      }]
    },
    options: {
      ...chartDefaults(),
      cutout: "73%",
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: context =>
              `${context.label}: ${formatNumber(context.raw)}`
          }
        }
      }
    }
  });
}

function renderDashboard(data, period, diagnostics) {
  const orders = data.orders;
  const values = data.orderValue;
  const customers = data.customers;

  $("totalOrders").textContent = formatNumber(orders.total);
  $("paidOrders").textContent = formatNumber(orders.paid);
  $("unpaidOrders").textContent = formatNumber(orders.unpaid);
  $("totalOrderValue").textContent = formatMoney(values.total);

  $("averageOrderValue").textContent =
    Number(orders.total) > 0
      ? formatMoney(Number(values.total) / Number(orders.total))
      : "—";

  $("activeCustomers").textContent = formatNumber(customers.active);
  $("returningCustomers").textContent = formatNumber(customers.returning);
  $("repeatBuyerRate").textContent = formatPercent(customers.repeatBuyerRate);
  $("returningCustomerRate").textContent = formatPercent(customers.returningCustomerRate);
  $("ordersPerCustomer").textContent = formatNumber(customers.ordersPerCustomer);
  $("newCustomers").textContent = formatNumber(customers.new);
  $("otherPaymentStatus").textContent = formatNumber(orders.otherPaymentStatus);

  $("lastUpdated").textContent = new Date(
    diagnostics.calculatedAt || Date.now()
  ).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  setConnection(
    true,
    "Connected to HighLevel",
    `${formatNumber(diagnostics.ordersFetched ?? 0)} orders fetched · ${period.startDate} to ${period.endDate}`
  );

  removeLoadingStyles();
  clearError();

  try {
    renderCharts(data);
  } catch (chartError) {
    console.error("Charts could not be rendered:", chartError);
    showError(
      "The metrics loaded successfully, but the charts could not load. Check your internet connection and refresh.",
      "Charts unavailable"
    );
  }
}

async function loadDashboard() {
  if (controller) controller.abort();

  controller = new AbortController();
  const signal = controller.signal;

  setLoading(true);
  clearError();

  const period = getDateRange();

  const params = new URLSearchParams({
    startDate: period.startDate,
    endDate: period.endDate
  });

  try {
    const response = await fetch(`/api/stats?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Request failed (${response.status})`);
    }

    if (
      !result.data?.orders ||
      !result.data?.orderValue ||
      !result.data?.customers
    ) {
      throw new Error("The API response is missing required dashboard data.");
    }

    renderDashboard(
      result.data,
      result.period || period,
      result.diagnostics || {}
    );

  } catch (err) {
    if (err.name === "AbortError") return;

    console.error("Dashboard loading failed:", err);

    setConnection(
      false,
      "Connection issue",
      "Dashboard data could not be loaded."
    );

    showError(
      "We couldn't retrieve the latest metrics. Check the deployment and API connection, then try refreshing."
    );

  } finally {
    if (controller && controller.signal === signal) {
      setLoading(false);
    }
  }
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("open");
}

function showPage(key) {
  const page = pages[key] || pages.overview;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === key);
  });

  $("pageTitle").textContent = page[1];
  $("pageDescription").textContent = page[3];

  const isOverview = key === "overview";

  $("overviewPage").hidden = !isOverview;
  $("placeholderPage").hidden = isOverview;

  if (!isOverview) {
    $("placeholderTitle").textContent = page[0];
    $("placeholderDescription").textContent = page[3];
    $("placeholderIcon").textContent = page[4];
    clearError();
  }

  closeSidebar();
}

document.querySelectorAll(".group-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const group = button.closest(".nav-group");
    const collapsed = group.classList.toggle("collapsed");

    button.setAttribute("aria-expanded", String(!collapsed));
  });
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

$("refresh").addEventListener("click", loadDashboard);
$("refreshMain").addEventListener("click", loadDashboard);
$("period").addEventListener("change", loadDashboard);

$("mobileMenu").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
  $("overlay").classList.toggle("open");
});

$("overlay").addEventListener("click", closeSidebar);

loadDashboard();
</script>

</body>
</html>

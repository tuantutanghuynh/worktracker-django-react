import PriorityBadge from './components/common/badges/PriorityBadge';
import RoleBadge from './components/common/badges/RoleBadge';
import SeverityBadge from './components/common/badges/SeverityBadge';
import StatusBadge from './components/common/badges/StatusBadge';
import DailyLimitProgressBar from './components/common/cards/DailyLimitProgressBar';
import StatCard from './components/common/cards/StatCard';
import SystemPolicyCard from './components/common/cards/SystemPolicyCard';
import DonutChartCard from './components/common/charts/DonutChartCard';
import HorizontalBarChartCard from './components/common/charts/HorizontalBarChartCard';
import LineChartCard from './components/common/charts/LineChartCard';
import ProductivityHeatmap from './components/common/charts/ProductivityHeatmap';

const donutData = [
  { name: 'To Do', value: 52 },
  { name: 'In Progress', value: 43 },
  { name: 'Reviewing', value: 34 },
  { name: 'Completed', value: 26 },
  { name: 'Cancelled', value: 17 },
];
const donutColors = ['#2563eb', '#10b981', '#8b5cf6', '#f97316', '#ef4444'];

const barData = [
  { name: 'ERP System Implementation', value: 18 },
  { name: 'Mobile App Development', value: 14 },
  { name: 'Website Redesign', value: 10 },
];

const lineData = [
  { name: 'Jan', value: 12 },
  { name: 'Feb', value: 19 },
  { name: 'Mar', value: 14 },
  { name: 'Apr', value: 22 },
];

const heatmapData = [
  {
    label: 'Nguyen A.',
    cells: [
      { date: '2026-08-01', hours: 5 },
      { date: '2026-08-02', hours: 6 },
      { date: '2026-08-03', hours: 6 },
      { date: '2026-08-04', hours: 4 },
      { date: '2026-08-05', hours: 2 },
      { date: '2026-08-06', hours: 0 },
      { date: '2026-08-07', hours: 0 },
    ],
  },
  {
    label: 'Tran B.',
    cells: [
      { date: '2026-08-01', hours: 3 },
      { date: '2026-08-02', hours: 4 },
      { date: '2026-08-03', hours: 4 },
      { date: '2026-08-04', hours: 3 },
      { date: '2026-08-05', hours: 1 },
      { date: '2026-08-06', hours: 0 },
      { date: '2026-08-07', hours: 0 },
    ],
  },
];

function App() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <PriorityBadge priority="LOW" />
        <PriorityBadge priority="MEDIUM" />
        <PriorityBadge priority="HIGH" />
        <RoleBadge role="ADMIN" />
        <RoleBadge role="MANAGER" />
        <RoleBadge role="EMPLOYEE" />
        <SeverityBadge severity="CRITICAL" />
        <SeverityBadge severity="WARNING" />
        <SeverityBadge severity="NORMAL" />
        <StatusBadge status="TODO" />
        <StatusBadge status="IN_PROGRESS" />
        <StatusBadge status="REVIEWING" />
        <StatusBadge status="ON_HOLD" />
        <StatusBadge status="COMPLETED" />
        <StatusBadge status="CANCELLED" />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard label="Managed Jobs" value="12" subtext="8 Active • 2 Planning • 2 On Hold" trend="20%" trendDirection="up" color="blue" tag="JOB Scope" />
        <StatCard label="Overdue Task Rate" value="8.7%" subtext="7 overdue of 80 total" trend="3.2%" trendDirection="down" color="purple" />
        <StatCard label="Team Work Hours" value="542.5h" subtext="This month" trend="15.2%" trendDirection="up" color="emerald" />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <SystemPolicyCard title="Daily Working Hours" description="Default hours used for workload capacity" value="8h" />
        <div>
          <p style={{ fontSize: 12, marginBottom: 4 }}>Daily log-work progress:</p>
          <DailyLimitProgressBar hoursLogged={6} dailyLimit={8} />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <DonutChartCard title="Task Status Summary" data={donutData} colors={donutColors} centerValue={172} centerLabel="Total Tasks" />
        <HorizontalBarChartCard title="Top Jobs by Open Tasks" data={barData} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <LineChartCard title="Jobs Created per Month" data={lineData} />
        <ProductivityHeatmap title="Productivity Heatmap (Work Hours)" data={heatmapData} />
      </section>
    </div>
  );
}

export default App;

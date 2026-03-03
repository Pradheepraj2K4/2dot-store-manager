export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', onClick }) {
  const colorMap = {
    blue: 'bg-blue-50 text-trust-blue',
    green: 'bg-emerald-50 text-credit-green',
    red: 'bg-rose-50 text-debit-red',
    amber: 'bg-amber-50 text-pending-amber',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div
      className={`card flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150' : ''}`}
      onClick={onClick}
    >
      {Icon && (
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-500 truncate">{title}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

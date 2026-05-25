import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export default function ComingSoonPage({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-trust-blue/10 text-trust-blue mb-4">
        <WrenchScrewdriverIcon className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
      <p className="text-sm text-slate-500 max-w-md">
        {description || 'This module is under construction and will be available soon.'}
      </p>
    </div>
  );
}

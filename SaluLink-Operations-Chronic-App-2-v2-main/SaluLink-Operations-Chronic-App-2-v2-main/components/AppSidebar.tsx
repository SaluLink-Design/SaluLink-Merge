'use client';

import Image from 'next/image';

type AppView =
  | 'landing'
  | 'onboarding'
  | 'assistant-home'
  | 'dashboard'
  | 'patient-info'
  | 'patient-profile'
  | 'case-options'
  | 'workflow';

interface NavItem {
  label: string;
  activeViews: AppView[];
  targetView: AppView | null;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    activeViews: ['dashboard', 'landing'],
    targetView: 'dashboard',
  },
  {
    label: 'Clinical Notes',
    activeViews: ['workflow', 'case-options'],
    targetView: 'dashboard',
  },
  {
    label: 'Patients',
    activeViews: ['patient-profile', 'assistant-home', 'patient-info'],
    targetView: 'dashboard',
  },
  {
    label: 'Reports',
    activeViews: [],
    targetView: null,
  },
  {
    label: 'Settings',
    activeViews: ['onboarding'],
    targetView: 'onboarding',
  },
];

interface AppSidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  userRole?: string | null;
}

const AppSidebar = ({ currentView, onNavigate, userRole }: AppSidebarProps) => {
  const isDoctorWorkspace = userRole === 'doctor';

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[#08080f] border-r border-white/5 flex flex-col z-30 shrink-0">
      {/* SaluLink logo — gradient Link in doctor workspace; flat cyan elsewhere */}
      <div className="px-6 pt-7 pb-1">
        <p className="text-[22px] font-bold tracking-tight leading-none">
          <span className="text-white">Salu</span>
          {isDoctorWorkspace ? (
            <span className="brand-link-gradient-text">Link</span>
          ) : (
            <span className="text-[#38b6ff]">Link</span>
          )}
        </p>
      </div>

      {/* Authi orb + powered by */}
      <div className="flex flex-col items-center px-4 py-6 mt-2">
        <div className="relative w-[90px] h-[90px]">
          <Image
            src="/salulink-orb.png"
            alt="Authi AI"
            fill
            className="object-contain drop-shadow-[0_0_28px_rgba(139,92,246,0.55)]"
            priority
          />
        </div>
        <p className="mt-3 text-[13px] font-semibold brand-link-gradient-text tracking-wide">
          Powered by Authi
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 mb-3 border-t border-white/[0.08]" />

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.activeViews.includes(currentView);
          const showNewCaseSubItem =
            item.label === 'Patients' && currentView === 'patient-info';

          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => item.targetView && onNavigate(item.targetView)}
                disabled={!item.targetView}
                className={
                  isActive
                    ? 'w-full flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white authi-gradient shadow-lg shadow-[#6366f1]/30 hover:opacity-90'
                    : 'w-full flex items-center px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:cursor-default disabled:opacity-50'
                }
              >
                {item.label}
              </button>

              {showNewCaseSubItem && (
                <div className="ml-4 mt-0.5 flex items-center gap-2 px-4 py-2">
                  <span className="text-slate-600 text-xs select-none">└</span>
                  <span className="text-xs font-medium brand-link-gradient-text">
                    Creating new case
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;

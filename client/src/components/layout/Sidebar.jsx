import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  HomeIcon,
  BookOpenIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  QueueListIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XMarkIcon,
  CubeIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  ArrowUturnLeftIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxIcon,
  CalculatorIcon,
  WrenchScrewdriverIcon,
  UserGroupIcon,
  PresentationChartLineIcon,
} from "@heroicons/react/24/outline";
import { logout, hasPermission, getCurrentUser } from "../../utils/auth";
import { interestApi, expenseApi, serviceApi } from "../../api";
import toast from "react-hot-toast";

const baseNavigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  {
    name: "Master",
    icon: Squares2X2Icon,
    children: [
      { name: "Ledgers", href: "/ledgers", icon: BookOpenIcon },
      { name: "Customers", href: "/customers", icon: UserGroupIcon },
      { name: "Items", href: "/items", icon: CubeIcon },
    ],
  },
  {
    name: "Inventory Transactions",
    icon: ClipboardDocumentListIcon,
    children: [
      { name: "Sales Entry", href: "/item-sales/new", icon: ShoppingBagIcon },
      { name: "Purchase Entry", href: "/item-purchases/new", icon: ArrowDownCircleIcon },
      { name: "Estimation", href: "/estimations", icon: CalculatorIcon },
      { name: "Sales Return Entry", href: "/sales-returns", icon: ArrowUturnLeftIcon },
      { name: "Purchase Return Entry", href: "/purchase-returns", icon: ArrowUturnLeftIcon },
    ],
  },
  {
    name: "Inventory Reports",
    icon: DocumentChartBarIcon,
    children: [
      { name: "Sales Report", href: "/sales-report", icon: DocumentChartBarIcon },
      { name: "Purchase Report", href: "/purchase-report", icon: DocumentChartBarIcon },
      { name: "Stock Report", href: "/stock-report", icon: ArchiveBoxIcon },
    ],
  },
  {
    name: "Account Transaction",
    icon: BanknotesIcon,
    children: [
      {
        name: "Payment Entry",
        href: "/payment-entry?type=payment",
        matchPath: "/payment-entry",
        matchSearch: "type=payment",
        icon: ArrowUpCircleIcon,
      },
      {
        name: "Receipt Entry",
        href: "/payment-entry?type=receipt",
        matchPath: "/payment-entry",
        matchSearch: "type=receipt",
        icon: ArrowDownCircleIcon,
      },
    ],
  },
  {
    name: "Accounts Reports",
    icon: DocumentTextIcon,
    children: [
      { name: "Day Book", href: "/day-book", icon: QueueListIcon },
      { name: "Accounts Statement", href: "/statement-of-account", icon: DocumentTextIcon },
      { name: "Outstanding Report", href: "/outstanding-balances", icon: CurrencyRupeeIcon },
      { name: "Bill Profit Report", href: "/bill-profit-report", icon: PresentationChartLineIcon },
      { name: "Overall Report", href: "/reports", icon: DocumentChartBarIcon },
    ],
  },
  { name: "Settings", href: "/settings", icon: Cog6ToothIcon },
];

export default function Sidebar({ open, onClose, collapsed = false, onToggleCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [expenseEnabled, setExpenseEnabled] = useState(false);
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState("Master");

  useEffect(() => {
    interestApi
      .isEnabled()
      .then((res) => {
        setInterestEnabled(res.data.enabled);
      })
      .catch(() => {});
    expenseApi
      .isEnabled()
      .then((res) => {
        const val = res.data?.value;
        setExpenseEnabled(val === true || val === "true");
      })
      .catch(() => {});
    serviceApi
      .isEnabled()
      .then((res) => {
        const val = res.data?.value;
        setServiceEnabled(val === true || val === "true");
      })
      .catch(() => {});
  }, []);

  const navigation = (() => {
    let nav = [...baseNavigation];
    if (interestEnabled) {
      // Insert after Accounts Reports group
      const acctIdx = nav.findIndex((n) => n.name === "Accounts Reports");
      const insertAt = acctIdx >= 0 ? acctIdx + 1 : nav.length;
      nav = [
        ...nav.slice(0, insertAt),
        {
          name: "Pending Interest",
          href: "/pending-interest",
          icon: ClockIcon,
        },
        {
          name: "Paid Interest",
          href: "/paid-interest",
          icon: CheckCircleIcon,
        },
        ...nav.slice(insertAt),
      ];
    }
    if (expenseEnabled) {
      // Add Expense Entry under "Account Transaction" and Expense Reports
      // under "Accounts Reports".
      nav = nav.map((item) => {
        if (item.name === "Account Transaction") {
          return {
            ...item,
            children: [
              ...item.children,
              { name: "Expense Entry", href: "/expenses", icon: BanknotesIcon },
            ],
          };
        }
        if (item.name === "Accounts Reports") {
          return {
            ...item,
            children: [
              ...item.children,
              { name: "Expense Reports", href: "/expense-reports", icon: DocumentChartBarIcon },
            ],
          };
        }
        return item;
      });
    }
    if (serviceEnabled) {
      // Add a Staffs entry under the Master group.
      nav = nav.map((item) => {
        if (item.name === "Master") {
          return {
            ...item,
            children: [
              ...item.children,
              { name: "Staffs", href: "/staffs", icon: UserGroupIcon },
            ],
          };
        }
        return item;
      });
      // Insert a dedicated Service group after the Master group.
      const masterIdx = nav.findIndex((n) => n.name === "Master");
      const insertAt = masterIdx >= 0 ? masterIdx + 1 : nav.length;
      nav = [
        ...nav.slice(0, insertAt),
        {
          name: "Service",
          icon: WrenchScrewdriverIcon,
          children: [
            { name: "Service Entry", href: "/services/new", icon: WrenchScrewdriverIcon },
            { name: "Pending Services", href: "/services/pending", icon: ClockIcon },
            { name: "Closed Services", href: "/services/closed", icon: CheckCircleIcon },
          ],
        },
        ...nav.slice(insertAt),
      ];
    }
    // Hide Settings for users without the manage-settings permission
    if (!hasPermission("manage_settings")) {
      nav = nav.filter((item) => item.name !== "Settings");
    }
    return nav;
  })();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  const currentUsername = getCurrentUser()?.username || "";

  // Auto-expand the group that contains the active route (keeping single-open).
  useEffect(() => {
    const activeGroup = baseNavigation.find(
      (item) =>
        item.children &&
        item.children.some((c) =>
          c.matchPath
            ? location.pathname === c.matchPath
            : location.pathname.startsWith(c.href),
        ),
    );
    if (activeGroup) setExpandedGroup(activeGroup.name);
  }, [location.pathname, location.search]);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 md:z-30 ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:-translate-x-full" : "md:translate-x-0"}`}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-trust-blue text-white font-bold text-sm">
            2D
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">
              2Dot Billz
            </h1>
            <p className="text-[10px] text-slate-400 leading-tight">
              Ease your billing worries
            </p>
          </div>
          <button
            onClick={onClose}
            className="md:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some((c) =>
                c.matchPath
                  ? location.pathname === c.matchPath &&
                    location.search === `?${c.matchSearch}`
                  : location.pathname.startsWith(c.href),
              );
              const isExpanded = expandedGroup === item.name;
              return (
                <div key={item.name}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroup((prev) =>
                        prev === item.name ? null : item.name,
                      )
                    }
                    className={`w-full group flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      isGroupActive
                        ? "text-white"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-0.5 ml-2 space-y-0.5 border-l border-slate-700 pl-2">
                        {item.children.map((child) => {
                          const childActive = child.matchPath
                            ? location.pathname === child.matchPath &&
                              location.search === `?${child.matchSearch}`
                            : undefined;
                          return (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            end={child.end}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                (childActive ?? isActive)
                                  ? "bg-trust-blue text-white shadow-sm shadow-trust-blue/25"
                                  : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-200"
                              }`
                            }
                          >
                            <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                            {child.name}
                          </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            // Items with matchPath use query-param based active detection
            if (item.matchPath) {
              const isActive =
                location.pathname === item.matchPath &&
                location.search === `?${item.matchSearch}`;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={() =>
                    `group flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-trust-blue text-white shadow-sm shadow-trust-blue/25"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.name}
                </NavLink>
              );
            }
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-trust-blue text-white shadow-sm shadow-trust-blue/25"
                      : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
                  }`
                }
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700 px-3 py-2">
          {currentUsername && (
            <div className="px-1 pb-1.5 text-[11px] text-slate-400 truncate">
              Logged in as <span className="font-medium text-slate-300">{currentUsername}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(-1)}
              title="Go back"
              className="flex items-center justify-center rounded-md p-1.5 transition-colors text-slate-300 hover:bg-sidebar-hover hover:text-white"
            >
              <ChevronLeftIcon className="h-4 w-4 flex-shrink-0" />
            </button>
            <button
              onClick={() => navigate(1)}
              title="Go forward"
              className="flex items-center justify-center rounded-md p-1.5 transition-colors text-slate-300 hover:bg-sidebar-hover hover:text-white"
            >
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-slate-300 hover:bg-red-500/10 hover:text-red-400"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4 flex-shrink-0" />
              Logout
            </button>
            <span className="text-[10px] text-slate-500 whitespace-nowrap">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Floating expand button — only visible when the sidebar is collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="hidden md:flex fixed bottom-3 left-3 z-40 h-8 w-8 items-center justify-center rounded-full bg-sidebar text-slate-300 shadow-md transition-colors hover:text-white"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      )}
    </>
  );
}

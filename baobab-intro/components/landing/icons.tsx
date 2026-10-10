import type { SVGProps } from "react";

/**
 * Icônes SVG dessinées à la main (trait 1,8 px, grille 24 px).
 * Pas de bibliothèque d'icônes : seules ces quelques formes sont nécessaires.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function NetworkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 6.5l4 4M17.5 6.5l-4 4M6.5 17.5l4-4M17.5 17.5l-4-4" />
      <circle cx="5" cy="5" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="19" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CodeBracesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4.5c-1.7 0-2.5.8-2.5 2.4v2.4c0 1.4-.8 2.2-2 2.7 1.2.5 2 1.3 2 2.7v2.4c0 1.6.8 2.4 2.5 2.4" />
      <path d="M16 4.5c1.7 0 2.5.8 2.5 2.4v2.4c0 1.4.8 2.2 2 2.7-1.2.5-2 1.3-2 2.7v2.4c0 1.6-.8 2.4-2.5 2.4" />
      <path d="M10.5 8.5v7M13.5 8.5v7" />
    </svg>
  );
}

export function MentorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.5" cy="8" r="2.8" />
      <circle cx="15.5" cy="8" r="2.8" />
      <path d="M3.5 18.5c.5-2.9 2.5-4.6 5-4.6 1.4 0 2.6.5 3.5 1.4.9-.9 2.1-1.4 3.5-1.4 2.5 0 4.5 1.7 5 4.6" />
    </svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 18.5h10.2a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.1 4.7 4.7 0 0 0 7 18.5z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={0} {...props}>
      <path
        fill="currentColor"
        d="M12 2.6l2.82 5.98 6.55.79-4.82 4.52 1.25 6.48L12 17.2l-5.8 3.17 1.25-6.48-4.82-4.52 6.55-.79z"
      />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={0} {...props}>
      <path fill="currentColor" d="M8 5.2v13.6c0 .8.86 1.28 1.54.86l10.9-6.8a1 1 0 0 0 0-1.72L9.54 4.34C8.86 3.92 8 4.4 8 5.2z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* ---------- Icônes des sections ---------- */

export function ForumIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5z" />
      <path d="M16.5 9h3A1.5 1.5 0 0 1 21 10.5v6a1.5 1.5 0 0 1-1.5 1.5h-1v3l-4-3H12" />
    </svg>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" />
    </svg>
  );
}

export function SchoolIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11v4.5c1.4 1.3 3.3 2 5.5 2s4.1-.7 5.5-2V11M21.5 9v5" />
    </svg>
  );
}

export function ServerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="7" rx="1.8" />
      <rect x="3.5" y="13" width="17" height="7" rx="1.8" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h5M11 16.5h5" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l2.7 2.7L16.2 9.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2.2} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11 3.5l1.6 4.4L17 9.5l-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6z" />
      <path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </svg>
  );
}

export function LightbulbIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 17.5h6M10 20.5h4" />
      <path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.1.9 1.8v.2h5v-.2c0-.7.3-1.3.9-1.8A5.8 5.8 0 0 0 12 3.5z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7.5 3v5.6c0 4.4-3.1 8.1-7.5 9.4-4.4-1.3-7.5-5-7.5-9.4V6z" />
      <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.2" />
      <path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5" />
    </svg>
  );
}

export function MergeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.5" cy="5.5" r="2" />
      <circle cx="6.5" cy="18.5" r="2" />
      <circle cx="17.5" cy="12" r="2" />
      <path d="M6.5 7.5v9M6.5 7.5c0 3 2.5 4.5 9 4.5" />
    </svg>
  );
}

export function EditorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14" />
    </svg>
  );
}

export function ContainerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

export function HubIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="19" cy="16" r="1.6" />
      <circle cx="5" cy="16" r="1.6" />
      <path d="M12 5.6v3.9M17.6 15.2l-3.4-2M6.4 15.2l3.4-2" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.4" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={0} {...props}>
      <path
        fill="currentColor"
        d="M12 2.3a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.3-1.3-3.3-1.3-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.6 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.3z"
      />
    </svg>
  );
}

/* ---------- Pour qui / supports de cours ---------- */

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 20.5V5.5A1.5 1.5 0 0 1 6 4h8a1.5 1.5 0 0 1 1.5 1.5v15M15.5 10H18a1.5 1.5 0 0 1 1.5 1.5v9M3 20.5h18" />
      <path d="M8 8h1.5M11 8h1M8 11.5h1.5M11 11.5h1M8 15h1.5M11 15h1" />
    </svg>
  );
}

export function ShopIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" />
      <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
    </svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5l5-3v9l-5-3z" />
    </svg>
  );
}

export function AudioIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3.5" y="13" width="4" height="7" rx="1.5" />
      <rect x="16.5" y="13" width="4" height="7" rx="1.5" />
    </svg>
  );
}

export function SlidesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.8" />
      <path d="M12 16.5v3.5M8.5 20h7M7.5 12.5l3-3 2.5 2 3.5-3.5" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  );
}

/* ---------- Pages Communauté, Blog et Docs ---------- */

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20.5 20.5" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" />
      <path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.6c1.8.6 3.1 2.2 3.5 4.4" />
    </svg>
  );
}

export function UserCheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="8.5" r="3.4" />
      <path d="M3.5 19.5c.7-3.4 3.2-5.3 6.5-5.3 1.4 0 2.6.3 3.6.9" />
      <path d="M15.5 17.5l2 2 4-4.5" />
    </svg>
  );
}

export function UserStarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="8.5" r="3.4" />
      <path d="M3.5 19.5c.7-3.4 3.2-5.3 6.5-5.3 1.1 0 2.1.2 3 .6" />
      <path d="M18 13.5l1.1 2.2 2.4.3-1.8 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.8-1.7 2.4-.3z" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" />
      <path d="M13.5 7l3 3M12 20h8" />
    </svg>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 4.5c2.7-.9 4.6-.8 5-.4.4.4.5 2.3-.4 5L14 14.2 9.8 10z" />
      <path d="M9.8 10L6 10.5 3.5 13l4 1M14 14.2l-.5 3.8L11 20.5l-1-4" />
      <path d="M6.5 17.5c-1.2.2-2.2 1.2-2.5 3 1.8-.3 2.8-1.3 3-2.5" />
      <circle cx="15.8" cy="8.2" r="1.3" />
    </svg>
  );
}

export function FolderCodeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z" />
      <path d="M10 11.5l-2 1.8 2 1.8M14 11.5l2 1.8-2 1.8" />
    </svg>
  );
}

export function ThumbUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 10.5V20H4.5v-9.5zM7.5 10.5l3.6-6.3c1.4 0 2.4 1.1 2.1 2.5l-.7 3.3h5.6a1.7 1.7 0 0 1 1.7 2l-1.3 6.6A2.2 2.2 0 0 1 16.3 20H7.5" />
    </svg>
  );
}

export function ThumbDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props} style={{ transform: "rotate(180deg)", ...props.style }}>
      <path d="M7.5 10.5V20H4.5v-9.5zM7.5 10.5l3.6-6.3c1.4 0 2.4 1.1 2.1 2.5l-.7 3.3h5.6a1.7 1.7 0 0 1 1.7 2l-1.3 6.6A2.2 2.2 0 0 1 16.3 20H7.5" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5" />
    </svg>
  );
}

export function BlockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.8" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="4.8" cy="12" r="0.9" fill="currentColor" />
      <circle cx="4.8" cy="17.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 4.5h6v6M19.5 4.5L11 13M17.5 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4" />
    </svg>
  );
}

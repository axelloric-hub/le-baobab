import type { SVGProps } from "react";

/** Icônes de l'espace membre — même dessin que le site (trait 1,8 px, grille 24, bouts arrondis). */
type P = SVGProps<SVGSVGElement>;
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
const I = (d: React.ReactNode) =>
  function Icon(props: P) {
    return (
      <svg {...base} {...props}>
        {d}
      </svg>
    );
  };

export const HomeIcon = I(<><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19z" /></>);
export const MessageIcon = I(<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />);
export const CommunityIcon = I(<><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.6c1.8.6 3.1 2.2 3.5 4.4" /></>);
export const LearnIcon = I(<><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.2c0 1.6 2.5 3.3 5.5 3.3s5.5-1.7 5.5-3.3V11M21.5 9v5" /></>);
export const ShowcaseIcon = I(<><path d="M8 7l-4.5 5L8 17M16 7l4.5 5L16 17M13.5 5l-3 14" /></>);
export const BriefcaseIcon = I(<><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>);
export const ShopIcon = I(<><path d="M4.5 9.5l1.2-4.5h12.6l1.2 4.5M4.5 9.5h15M4.5 9.5c0 1.6 1.3 2.5 2.6 2.5s2.5-.9 2.5-2.5c0 1.6 1.2 2.5 2.4 2.5s2.4-.9 2.4-2.5c0 1.6 1.2 2.5 2.5 2.5s2.6-.9 2.6-2.5" /><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4" /></>);
export const BellIcon = I(<><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>);
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />);
export const SearchIcon = I(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20.5 20.5" /></>);
export const MoreIcon = I(<><circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" /></>);
export const CloseIcon = I(<path d="M6 6l12 12M18 6L6 18" />);
export const ChevronLeftIcon = I(<path d="M14.5 6l-6 6 6 6" />);
export const ChevronRightIcon = I(<path d="M9.5 6l6 6-6 6" />);
export const ChevronDownIcon = I(<path d="M6 9.5l6 6 6-6" />);
export const ChevronUpIcon = I(<path d="M6 14.5l6-6 6 6" />);
export const ArrowUpIcon = I(<path d="M12 19V5M6 11l6-6 6 6" />);
export const ArrowLeftIcon = I(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const GlobeIcon = I(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z" /></>);
export const UserCheckIcon = I(<><circle cx="10" cy="8.5" r="3.4" /><path d="M3.5 19.5c.7-3.4 3.2-5.3 6.5-5.3 1.4 0 2.6.3 3.6.9" /><path d="M15.5 17.5l2 2 4-4.5" /></>);
export const UsersIcon = CommunityIcon;
export const StarUserIcon = I(<><circle cx="10" cy="8.5" r="3.4" /><path d="M3.5 19.5c.7-3.4 3.2-5.3 6.5-5.3 1.1 0 2.1.2 3 .6" /><path d="M18 13.5l1.1 2.2 2.4.3-1.8 1.7.4 2.4-2.1-1.1-2.1 1.1.4-2.4-1.8-1.7 2.4-.3z" /></>);
export const HubIcon = I(<><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="5.5" r="1.8" /><circle cx="19" cy="5.5" r="1.8" /><circle cx="12" cy="20" r="1.8" /><path d="M10.3 10.3L6.3 6.8M13.7 10.3l4-3.5M12 14.4v3.8" /></>);
export const ListIcon = I(<><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.8" cy="6.5" r="0.9" fill="currentColor" /><circle cx="4.8" cy="12" r="0.9" fill="currentColor" /><circle cx="4.8" cy="17.5" r="0.9" fill="currentColor" /></>);
export const LockIcon = I(<><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>);
export const ImageIcon = I(<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5L6 19.5" /></>);
export const CodeIcon = I(<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14" />);
export const PollIcon = I(<><path d="M5 20V12M10 20V6M15 20v-9M20 20V4" /></>);
export const LinkIcon = I(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" /></>);
export const ProjectIcon = I(<><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z" /><path d="M10 11.5l-2 1.8 2 1.8M14 11.5l2 1.8-2 1.8" /></>);
export const SendIcon = I(<path d="M4 12l16-8-6 16-2.5-6.5z" />);
export const TrashIcon = I(<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5" />);
export const PenIcon = I(<><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M13.5 7l3 3" /></>);
export const FlagIcon = I(<path d="M5.5 20.5V4.5M5.5 4.5h11l-2 4 2 4h-11" />);
export const CopyIcon = I(<><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>);
export const CheckIcon = I(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const CommentIcon = I(<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />);
export const ShareIcon = I(<><path d="M4 12v6.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V12" /><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" /></>);
export const BookmarkIcon = I(<path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" />);
export const BookmarkFilledIcon = I(<path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" fill="currentColor" />);
export const ThumbIcon = I(<path d="M7.5 10.5V20H4.5v-9.5zM7.5 10.5l3.6-6.3c1.4 0 2.4 1.1 2.1 2.5l-.7 3.3h5.6a1.7 1.7 0 0 1 1.7 2l-1.3 6.6A2.2 2.2 0 0 1 16.3 20H7.5" />);
export const TrendingIcon = I(<><path d="M3.5 17l6-6 4 4 7-7.5" /><path d="M15 7.5h5.5V13" /></>);
export const PlayIcon = I(<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />);
export const PauseIcon = I(<><rect x="7" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" stroke="none" /><rect x="13.8" y="5.5" width="3.2" height="13" rx="1" fill="currentColor" stroke="none" /></>);
export const VolumeIcon = I(<><path d="M4.5 9.5h3.5L12.5 5.5v13L8 14.5H4.5z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>);
export const MuteIcon = I(<><path d="M4.5 9.5h3.5L12.5 5.5v13L8 14.5H4.5z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" /></>);
export const VideoIcon = I(<><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="M16 10.5l5-3v9l-5-3" /></>);
export const AudioIcon = I(<><path d="M9 18V6.5l11-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>);
export const TextIcon = I(<path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />);
export const FileIcon = I(<><path d="M7 3.5h7l4.5 4.5v12.5H7z" /><path d="M14 3.5V8h4.5" /></>);
export const LogoutIcon = I(<><path d="M14.5 4.5h4A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-4" /><path d="M10 16.5L5 12l5-4.5M5 12h11" /></>);
export const UserIcon = I(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6" /></>);
export const HashIcon = I(<path d="M9.5 4l-2 16M16.5 4l-2 16M4.5 9h15M3.5 15h15" />);
export const RefreshIcon = I(<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2" />);
export const WifiOffIcon = I(<><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M14 9.9a10 10 0 0 1 5 2.6M2 9a14 14 0 0 1 4.5-2.8M10.5 5.1A14 14 0 0 1 22 9" /><circle cx="12" cy="19.5" r="0.8" fill="currentColor" /></>);
export const SparklesIcon = I(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />);
export const ExternalIcon = I(<><path d="M13.5 4.5h6v6M19.5 4.5L11 13" /><path d="M17.5 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4" /></>);
export const SpinnerIcon = I(<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />);

/* Lot 2 : messagerie, profil, notifications. */
export const PaperclipIcon = I(<path d="M20 11.5l-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l8.4-8.4a3.1 3.1 0 0 1 4.4 4.4l-8.4 8.4a1.5 1.5 0 0 1-2.2-2.2l7.6-7.6" />);
export const DoubleCheckIcon = I(<><path d="M2.5 12.5l4.2 4.2L15 8.5" /><path d="M11 16.2l.5.5L21.5 6.5" /></>);
export const ClockIcon = I(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const ReplyIcon = I(<path d="M10 7L4.5 12 10 17M4.5 12H14a5.5 5.5 0 0 1 5.5 5.5V19" />);
export const SmileIcon = I(<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" /><path d="M9 9.8h.01M15 9.8h.01" strokeWidth="2.4" /></>);
export const ArrowDownIcon = I(<path d="M12 5v14M6 13l6 6 6-6" />);
export const MapPinIcon = I(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const CalendarIcon = I(<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const UserPlusIcon = I(<><circle cx="9.5" cy="8.5" r="3.5" /><path d="M3 19.5c.7-3.2 3.3-5.2 6.5-5.2 1.6 0 3 .5 4.1 1.3M18 13v6M15 16h6" /></>);
export const UserMinusIcon = I(<><circle cx="9.5" cy="8.5" r="3.5" /><path d="M3 19.5c.7-3.2 3.3-5.2 6.5-5.2 1.6 0 3 .5 4.1 1.3M15 16h6" /></>);
export const BlockIcon = I(<><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>);
export const VerifiedIcon = I(<><path d="M12 2.8l2.4 1.7 2.9-.1.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.1L12 21.2l-2.4-1.7-2.9.1-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.1z" /><path d="M8.6 12.2l2.3 2.3 4.6-4.6" /></>);
export const SettingsIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const CheckAllIcon = DoubleCheckIcon;
export const CameraIcon = I(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.5" r="3.5" /></>);
export const GraduationIcon = LearnIcon;
export const AwardIcon = I(<><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5" /></>);
export const TimelineIcon = I(<><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M10 6h10M10 18h10M10 12h7" /></>);
export const RepoIcon = I(<><path d="M5.5 4.5A1.5 1.5 0 0 1 7 3h12v15H7a1.5 1.5 0 0 0-1.5 1.5z" /><path d="M5.5 19.5A1.5 1.5 0 0 0 7 21h12v-3M9 7h6" /></>);
export const StarIcon = I(<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />);
export const CartIcon = I(<><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>);
export const HeartIcon = I(<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />);
export const DownloadIcon = I(<><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" /></>);
export const KeyIcon = I(<><circle cx="8" cy="15" r="4" /><path d="M10.9 12.1L20 3M16.5 6.5l2.5 2.5M14.5 8.5l2 2" /></>);
export const TagIcon = I(<><path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z" /><circle cx="8.5" cy="8.5" r="1.5" /></>);
export const ReceiptIcon = I(<><path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.2-1.5 1.2-2-1.5L6 20.5z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>);
export const UploadIcon = I(<><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" /></>);

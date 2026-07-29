export type IconName =
  | "alert-circle"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "bell"
  | "calendar"
  | "check"
  | "clipboard"
  | "close"
  | "download"
  | "flask"
  | "heart"
  | "help-circle"
  | "home"
  | "mail"
  | "message"
  | "pill"
  | "plus"
  | "search"
  | "shield-check";

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    "alert-circle": <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </>,
    "arrow-left": <>
      <path d="m15 18-6-6 6-6" />
    </>,
    "arrow-right": <>
      <path d="m9 18 6-6-6-6" />
    </>,
    "arrow-up-right": <>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </>,
    bell: <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>,
    calendar: <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </>,
    check: <path d="m5 12 4 4L19 6" />,
    clipboard: <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h4" />
    </>,
    close: <>
      <path d="m7 7 10 10M17 7 7 17" />
    </>,
    download: <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
    flask: <>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <path d="M7.5 15h9" />
    </>,
    heart: <path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z" />,
    "help-circle": <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.9M12 17h.01" />
    </>,
    home: <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </>,
    mail: <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>,
    message: <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>,
    pill: <>
      <path d="m8.5 18.5-3-3a4.2 4.2 0 0 1 0-6l4-4a4.2 4.2 0 0 1 6 0l3 3a4.2 4.2 0 0 1 0 6l-4 4a4.2 4.2 0 0 1-6 0Z" />
      <path d="m8 7 9 9" />
    </>,
    plus: <>
      <path d="M12 5v14M5 12h14" />
    </>,
    search: <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>,
    "shield-check": <>
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  };

  return (
    <svg
      aria-hidden="true"
      className={className ? `icon ${className}` : "icon"}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  );
}
import type { ReactNode } from "react";

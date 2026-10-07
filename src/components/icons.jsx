// Small hand-rolled icon set (stroke-based, 24x24) so the app has no icon
// library dependency. Each icon accepts standard svg props (className etc.)
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

export const HomeIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
)

export const BoxIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
)

export const ScanIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 7V5a1 1 0 011-1h2" />
    <path d="M20 7V5a1 1 0 00-1-1h-2" />
    <path d="M4 17v2a1 1 0 001 1h2" />
    <path d="M20 17v2a1 1 0 01-1 1h-2" />
    <path d="M4 12h16" />
  </svg>
)

export const ClipboardIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="6" y="4" width="12" height="17" rx="1.5" />
    <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
    <path d="M9 11h6M9 15h6" />
  </svg>
)

export const TruckIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="1" y="6" width="13" height="11" rx="1" />
    <path d="M14 10h4l3 3v4h-7z" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="17" cy="19" r="2" />
  </svg>
)

export const PlusIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const MinusIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14" />
  </svg>
)

export const SearchIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
)

export const ChevronLeftIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

export const ChevronRightIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const AlertIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M10.3 3.9L1.8 18a1.5 1.5 0 001.3 2.3h17.8a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
)

export const CheckIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

export const XIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

export const EditIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </svg>
)

export const TrashIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
  </svg>
)

export const DownloadIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
)

export const UploadIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 21V9" />
    <path d="M7 14l5-5 5 5" />
    <path d="M5 3h14" />
  </svg>
)

export const QrIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3zM20 14v3M17 20h3" />
  </svg>
)

export const CameraIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M4 8a2 2 0 012-2h1l1.5-2h7L17 6h1a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

export const SyncIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 12a9 9 0 0115-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 01-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

export const ReceiptIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
)

export const PackageCheckIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M21 8l-9-5-9 5 9 5 9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M9.5 12.5l1.8 1.8L15 10.5" />
  </svg>
)

export const ShoppingBagIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

export const BellIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 10a6 6 0 1 1 12 0c0 3 1 5 2 6H4c1-1 2-3 2-6z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
)

export const PinIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />
  </svg>
)

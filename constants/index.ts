import {
  CircleEllipsis,
  Download,
  Edit,
  File,
  Image,
  Info,
  LayoutDashboard,
  Share,
  Trash,
  Video,
} from "lucide-react";

export const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, url: "/" },
  { name: "Documents", icon: File, url: "/documents" },
  { name: "Images", icon: Image, url: "/images" },
  { name: "Media", icon: Video, url: "/media" },
  { name: "Others", icon: CircleEllipsis, url: "/others" },
];

export const actionsDropdownItems = [
  {
    label: "Rename",
    icon: Edit,
    value: "rename",
  },
  {
    label: "Details",
    icon: Info,
    value: "details",
  },
  {
    label: "Share",
    icon: Share,
    value: "share",
  },
  {
    label: "Download",
    icon: Download,
    value: "download",
  },
  {
    label: "Delete",
    icon: Trash,
    value: "delete",
  },
];

export const sortTypes = [
  {
    label: "Date created (newest)",
    value: "$createdAt-desc",
  },
  {
    label: "Created Date (oldest)",
    value: "$createdAt-asc",
  },
  {
    label: "Name (A-Z)",
    value: "name-asc",
  },
  {
    label: "Name (Z-A)",
    value: "name-desc",
  },
  {
    label: "Size (Highest)",
    value: "size-desc",
  },
  {
    label: "Size (Lowest)",
    value: "size-asc",
  },
];

export const avatarPlaceholderUrl =
  "https://www.svgrepo.com/show/382097/female-avatar-girl-face-woman-user-9.svg";

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

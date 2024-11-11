"use client";

import { avatarPlaceholderUrl, navItems } from "@/constants";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const Sidebar = ({ fullName, email }: { fullName: string; email: string }) => {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/" className="flex justify-center">
        <Image
          src="/images/icon1_trans.png"
          alt="icon"
          width={160}
          height={50}
          className="hidden h-auto lg:block"
        />

        <Image
          src="/images/icon1_trans.png"
          alt="logo"
          width={52}
          height={52}
          className="lg:hidden"
        />
      </Link>

      <nav className="sidebar-nav">
        <ul className="flex flex-1 flex-col gap-6">
          {navItems.map(({ url, name, icon }) => (
            <Link href={url} key={name} className="lg:w-full">
              <li
                className={cn(
                  "sidebar-nav-item",
                  pathname === url && "shad-active",
                )}
              >
                {React.createElement(icon, {
                  className: `${cn("nav-icon", pathname === url && "nav-icon-active")}`,
                })}
                <p className="hidden lg:block">{name}</p>
              </li>
            </Link>
          ))}
        </ul>
      </nav>

      <Image
        src="/images/icon_trans.png"
        alt="file container"
        width={506}
        height={418}
        className="w-full"
      />

      <div className="sidebar-user-info">
        <Image
          src={avatarPlaceholderUrl}
          alt="avatar"
          width={44}
          height={44}
          className="sidebar-user-avatar"
        />

        <div className="hidden lg:block">
          <p className="subtitle-2 capitalize">{fullName}</p>
          <p className="caption">{email}</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

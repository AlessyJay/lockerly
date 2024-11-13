"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { navItems } from "@/constants";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import FileUploader from "./FileUploader";
import { SignOutUser } from "@/lib/actions/user.actions";

const MobileNav = ({
  fullName,
  email,
  avatar,
  accountId,
  userId,
}: {
  fullName: string;
  email: string;
  avatar: string;
  accountId: string;
  userId: string;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pathname = usePathname();

  return (
    <header className="mobile-header">
      <Image
        src="/images/icon1_trans.png"
        alt="logo"
        width={69}
        height={52}
        className="h-auto"
      />

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger>
          <Menu />
        </SheetTrigger>
        <SheetContent className="shad-sheet h-screen px-3">
          <SheetHeader>
            <SheetTitle>
              <div className="header-user">
                <Avatar>
                  <AvatarImage src={avatar} />
                  <AvatarFallback>{fullName[0]}</AvatarFallback>
                </Avatar>

                <div className="sm:hidden lg:block">
                  <p className="subtitle-2 capitalize">{fullName}</p>
                  <p className="caption">{email}</p>
                </div>
              </div>
              <Separator className="mb-4 bg-light-200/20" />
            </SheetTitle>

            <nav className="mobile-nav">
              <ul className="mobile-nav-list">
                {navItems.map(({ url, name, icon }) => (
                  <Link href={url} key={name} className="lg:w-full">
                    <li
                      className={cn(
                        "mobile-nav-item",
                        pathname === url && "shad-active",
                      )}
                    >
                      {React.createElement(icon, {
                        className: `${cn("nav-icon", pathname === url && "nav-icon-active")}`,
                      })}
                      <p>{name}</p>
                    </li>
                  </Link>
                ))}
              </ul>
            </nav>

            <Separator className="my-5 bg-light-200/20" />

            <div className="flex flex-col justify-between gap-5 pb-5">
              <FileUploader accountId={accountId} ownerId={userId} />
              <Button
                type="submit"
                onClick={async () => await SignOutUser}
                className="mobile-sign-out-button"
              >
                <LogOut className="w-6" />
              </Button>
            </div>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default MobileNav;

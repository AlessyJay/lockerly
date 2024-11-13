import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import { getCurrentUser } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import React from "react";

const layout = async ({ children }: { children: React.ReactNode }) => {
  const currentUser = await getCurrentUser();

  if (!currentUser) return redirect("/sign-in");
  return (
    <main className="flex h-screen">
      <Sidebar
        fullName={currentUser.fullName}
        email={currentUser.email}
        avatar={currentUser.avatar}
      />
      <section className="flex h-full flex-1 flex-col">
        <MobileNav
          fullName={currentUser.fullName}
          email={currentUser.email}
          avatar={currentUser.avatar}
          accountId={currentUser.accountId}
          userId={currentUser.$id}
        />
        <Header userId={currentUser.$id} accountId={currentUser.accountId} />

        <div className="main-content">{children}</div>
      </section>

      <Toaster />
    </main>
  );
};

export default layout;

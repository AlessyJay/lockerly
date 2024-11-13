import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const LoadingCard = () => {
  return (
    <div>
      <Skeleton className="h-[20px] w-[100px] rounded-full" />
    </div>
  );
};

export default LoadingCard;

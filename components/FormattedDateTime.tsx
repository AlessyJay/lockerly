import { cn, formatDateTime } from "@/lib/utils";
import React from "react";

const FormattedDateTime = ({
  date,
  className,
}: {
  date: string;
  className?: string;
}) => {
  return (
    <span className={cn("body-1 text-light-200", className)}>
      {formatDateTime(date)}
    </span>
  );
};

export default FormattedDateTime;

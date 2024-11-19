"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sortTypes } from "@/constants";

const Sort = () => {
  const router = useRouter();
  const path = usePathname();
  const searchParams = useSearchParams();

  const handleSort = (value: string) => {
    const currentQyery = searchParams.get("query") || "";
    const updatedUrl = currentQyery
      ? `${path}?query=${currentQyery}?sort=${value}`
      : `${path}?sort=${value}`;

    router.push(updatedUrl);
  };

  return (
    <Select onValueChange={handleSort} defaultValue={sortTypes[0].value}>
      <SelectTrigger className="sort-select">
        <SelectValue placeholder={sortTypes[0].value} />
      </SelectTrigger>
      <SelectContent className="sort-select-content">
        {sortTypes.map((type) => (
          <SelectItem
            key={type.value}
            value={type.value}
            className="shad-select-item"
          >
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default Sort;

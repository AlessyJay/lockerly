"use client";

import Image from "next/image";
import Link from "next/link";
import { Models } from "node-appwrite";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Transparent overlay covering a file row/card: images open in a lightbox,
 * everything else opens in a new tab. Keep it before the ActionDropdown so the
 * menu (which is `relative`) stays clickable above it.
 */
const FilePreview = ({
  file,
  className,
}: {
  file: Models.DefaultDocument;
  className?: string;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const overlayClassName = cn("absolute inset-0", className);

  if (file.type !== "image") {
    return (
      <Link
        href={file.url}
        target="_blank"
        aria-label={file.name}
        className={overlayClassName}
      />
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`Preview ${file.name}`}
        className={overlayClassName}
      />
      <DialogContent
        aria-describedby={undefined}
        // w-max: size from the image; w-auto only gets 50vw because of left-1/2.
        className="w-max max-w-none place-items-center rounded-[20px] border-none p-3 duration-300 sm:rounded-[20px]"
      >
        <DialogTitle className="sr-only">{file.name}</DialogTitle>

        {!isLoaded && (
          <Loader2 className="absolute size-8 animate-spin text-brand" />
        )}

        {/* unoptimized: show the original, and SVGs the image optimizer rejects */}
        <Image
          src={file.url}
          alt={file.name}
          width={0}
          height={0}
          unoptimized
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "size-auto max-h-[80vh] min-h-40 min-w-40 max-w-[85vw] rounded-[14px] object-contain transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;

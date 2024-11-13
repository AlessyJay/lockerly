"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { cn, convertFileToUrl, getFileType } from "@/lib/utils";
import { File, Upload, X } from "lucide-react";
import Thumbnail from "./Thumbnail";
import { Progress } from "@/components/ui/progress";
import { MAX_FILE_SIZE } from "@/constants";
import { useToast } from "@/hooks/use-toast";
import { uploadFile } from "@/lib/actions/file.actions";
import { usePathname } from "next/navigation";

export default function FileUploader({
  className,
  ownerId,
  accountId,
}: {
  className?: string;
  ownerId: string;
  accountId: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const pathname = usePathname();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setFiles(acceptedFiles);

      const uploadPromises = acceptedFiles.map(async (file) => {
        if (file.size > MAX_FILE_SIZE) {
          setFiles((prev) => prev.filter((f) => f.name !== file.name));

          return toast({
            title: "File too large",
            description: (
              <p className="body-2 text-white">
                <span className="font-semibold">{file.name}</span> is too large.
                Max file size is 50MB
              </p>
            ),
            className: "error-toast",
            variant: "destructive",
          });
        }

        return uploadFile({
          file,
          ownerId,
          accountId,
          path: pathname,
        }).then((uploadedFile) => {
          if (uploadedFile) {
            setFiles((prev) => prev.filter((f) => f.name !== file.name));
          }
        });
      });

      await Promise.all(uploadPromises);
    },
    [accountId, ownerId, pathname, toast],
  );

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleFileRemove = ({
    e,
    fileName,
  }: {
    e: React.MouseEvent<SVGSVGElement, MouseEvent>;
    fileName: string;
  }) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  return (
    <div {...getRootProps()} className="cursor-pointer">
      <input {...getInputProps()} />
      <Button type="button" className={cn("uploader-button", className)}>
        <Upload />
        <p className="">Upload</p>
      </Button>
      {files.length > 0 && (
        <ul className="uploader-preview-list">
          <h4 className="h4 text-light-100">Uploading...</h4>

          {files.map((file, index) => {
            const { type, extension } = getFileType(file.name);

            return (
              <li
                className="uploader-preview-item"
                key={`${file.name}-${index}`}
              >
                <div className="flex items-center gap-3">
                  <Thumbnail
                    type={type}
                    extension={extension}
                    url={convertFileToUrl(file)}
                  />

                  <div className="preview-item-name">
                    <p>{file.name}</p>

                    <Progress value={33} />
                  </div>
                </div>
                <X
                  onClick={(e) => handleFileRemove({ e, fileName: file.name })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { cn, convertFileToUrl, getFileType } from "@/lib/utils";
import { File, Upload, X } from "lucide-react";
import Thumbnail from "./Thumbnail";
import { MAX_FILE_SIZE } from "@/constants";
import { useToast } from "@/hooks/use-toast";
import { getUploadToken, uploadFile } from "@/lib/actions/file.actions";
import { usePathname } from "next/navigation";

// Appwrite takes files over 5MB in 5MB chunks.
const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Upload straight from the browser to the bucket, so we get real progress.
 * XHR, not fetch: only XHR reports upload progress. Returns the bucket file id.
 */
const uploadToBucket = async (
  file: File,
  jwt: string,
  onProgress: (loaded: number) => void,
) => {
  const fileId = crypto.randomUUID().replace(/-/g, "").slice(0, 20);

  for (let start = 0; ; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const form = new FormData();
    form.append("fileId", fileId);
    form.append("file", file.slice(start, end), file.name);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_BUCKET}/files`,
      );
      xhr.setRequestHeader(
        "X-Appwrite-Project",
        process.env.NEXT_PUBLIC_APPWRITE_PROJECT!,
      );
      xhr.setRequestHeader("X-Appwrite-JWT", jwt);
      if (file.size > CHUNK_SIZE) {
        xhr.setRequestHeader(
          "Content-Range",
          `bytes ${start}-${end - 1}/${file.size}`,
        );
        xhr.setRequestHeader("X-Appwrite-ID", fileId);
      }
      // e.total includes multipart overhead, so scale it to this chunk's bytes.
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(start + (end - start) * (e.loaded / e.total));
      };
      xhr.onload = () =>
        xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });

    if (end >= file.size) break;
  }

  onProgress(file.size);
  return fileId;
};

export default function FileUploader({ className }: { className?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  // Bytes sent per file name, across everything dropped since the card opened.
  const [progress, setProgress] = useState<
    Record<string, { loaded: number; total: number }>
  >({});
  const { toast } = useToast();
  const pathname = usePathname();

  const totals = Object.values(progress).reduce(
    (sum, p) => ({ loaded: sum.loaded + p.loaded, total: sum.total + p.total }),
    { loaded: 0, total: 0 },
  );
  const percent = totals.total
    ? Math.round((totals.loaded / totals.total) * 100)
    : 0;

  // Keep showing the last files while the card fades out, instead of an empty card.
  const lastFiles = useRef<File[]>([]);
  if (files.length > 0) lastFiles.current = files;
  const shownFiles = files.length > 0 ? files : lastFiles.current;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const toUpload = acceptedFiles.filter((file) => {
        if (file.size <= MAX_FILE_SIZE) return true;

        toast({
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
        return false;
      });

      // Add to uploads already running; start the bar fresh when the card was closed.
      setFiles((prev) => [...prev, ...toUpload]);
      setProgress((prev) => ({
        ...(files.length > 0 ? prev : {}),
        ...Object.fromEntries(
          toUpload.map((file) => [file.name, { loaded: 0, total: file.size }]),
        ),
      }));

      const uploadPromises = toUpload.map(async (file) => {
        try {
          const jwt = await getUploadToken();

          const bucketFileId = await uploadToBucket(file, jwt, (loaded) =>
            setProgress((prev) => ({
              ...prev,
              [file.name]: { loaded, total: file.size },
            })),
          );

          await uploadFile({ bucketFileId, path: pathname });
        } catch {
          // Drop it from the bar so the remaining uploads still add up to 100%.
          setProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });

          toast({
            title: "Upload failed",
            description: (
              <p className="body-2 text-white">
                <span className="font-semibold">{file.name}</span> could not be
                uploaded. Please try again.
              </p>
            ),
            className: "error-toast",
            variant: "destructive",
          });
        } finally {
          setFiles((prev) => prev.filter((f) => f.name !== file.name));
        }
      });

      await Promise.all(uploadPromises);
    },
    [files.length, pathname, toast],
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
      <div
        aria-hidden={files.length === 0}
        className={cn(
          "uploader-preview-list transition-[opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none",
          files.length > 0
            ? "translate-y-0 opacity-100"
            : "invisible translate-y-4 opacity-0",
        )}
      >
        <h4 className="h4 text-light-100">Uploading...</h4>

        <ul className="flex flex-col gap-3">
          {shownFiles.map((file, index) => {
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
                  </div>
                </div>
                <X
                  onClick={(e) => handleFileRemove({ e, fileName: file.name })}
                />
              </li>
            );
          })}
        </ul>

        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1 w-full overflow-hidden rounded-full bg-light-300"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

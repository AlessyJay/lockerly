import React from "react";
import { Models } from "node-appwrite";
import Thumbnail from "./Thumbnail";
import FormattedDateTime from "./FormattedDateTime";
import { formatDateTime } from "@/lib/utils";
import { convertFileSize } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Trash } from "lucide-react";

const ImageThumbnail = ({ file }: { file: Models.Document }) => {
  return (
    <div className="file-details-thumbnail">
      <Thumbnail type={file.type} extension={file.extension} url={file.url} />
      <div className="flex flex-col">
        <p className="subtitle-2 mb-1">{file.name}</p>
        <FormattedDateTime date={file.$createdAt} className="caption" />
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="flex">
      <p className="file-details-label text-left">{label}</p>
      <p className="file-details-label text-left">{value}</p>
    </div>
  );
};

export const FileDetails = ({ file }: { file: Models.Document }) => {
  return (
    <React.Fragment>
      <ImageThumbnail file={file} />
      <div className="space-y-4 px-2 pt-2">
        <DetailRow label="Format:" value={file.extension} />
        <DetailRow label="Size:" value={convertFileSize(file.size)} />
        <DetailRow label="Owner:" value={file.owner.fullName} />
        <DetailRow label="Last Edit:" value={formatDateTime(file.$updatedAt)} />
      </div>
    </React.Fragment>
  );
};

export const ShareInput = ({
  file,
  onInputChange,
  onRemove,
  isLoading,
}: ShareProps) => {
  return (
    <React.Fragment>
      <ImageThumbnail file={file} />
      <div className="share-wrapper">
        <p className="subtitle-2 pl-1 text-light-100">
          Share file with other users
        </p>

        <Input
          type="email"
          placeholder="Enter email address"
          onChange={(e) => onInputChange(e.target.value.trim().split(","))}
          className="share-input-field"
        />

        <div className="pt-4">
          <div className="flex justify-between">
            <p className="subtitle-2 text-light-100">Shared with</p>
            <p className="subtitle-2 text-light-200">
              {file.users.length} users
            </p>
          </div>
          <ul className="pt-2">
            {file.users.map((email: string) => (
              <li
                className="flex items-center justify-between gap-2"
                key={email}
              >
                <p className="subtitle-2 line-clamp-1">{email}</p>
                <Button
                  className="share-remove-user"
                  onClick={() => onRemove(email)}
                  disabled={isLoading}
                >
                  <Trash className="remove-icon" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </React.Fragment>
  );
};

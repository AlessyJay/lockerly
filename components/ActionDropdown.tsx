"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, MoreVertical } from "lucide-react";
import { Models } from "node-appwrite";
import { actionsDropdownItems } from "@/constants";
import Link from "next/link";
import { constructDownloadUrl } from "@/lib/utils";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  deleteFile,
  renameFile,
  updateFileUsers,
} from "@/lib/actions/file.actions";
import { usePathname } from "next/navigation";
import { FileDetails, ShareInput } from "./ActionsModalContent";

const ActionDropdown = ({ file }: { file: Models.Document }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [action, setAction] = useState<ActionType | null>(null);
  const [name, setName] = useState<string>(file.name);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [isRemovingUser, setIsRemovingUser] = useState<boolean>(false);

  const pathname = usePathname();

  const closeAllModel = () => {
    setIsOpen(false);
    setIsDropdownOpen(false);
    setAction(null);
    setName(file.name);
  };

  /**
   * Handles the action when a user selects an item from the action dropdown.
   *
   *
   * This function is called when the user selects an item from the action dropdown.
   * It will call the corresponding action function and then close the model.
   * If the action is successful, it will also revalidate the current page.
   */
  const handleAction = async () => {
    if (!action) return;

    setIsLoading(true);
    let success = false;

    const actions = {
      rename: () =>
        renameFile({
          fileId: file.$id,
          name,
          extension: file.extension,
          path: pathname,
        }),

      share: () =>
        updateFileUsers({
          fileId: file.$id,
          emails,
          path: pathname,
        }),

      delete: () =>
        deleteFile({
          fileId: file.$id,
          bucketFileId: file.bucketFileId,
          path: pathname,
        }),
    };

    success = await actions[action.value as keyof typeof actions]();

    if (success) closeAllModel();

    setIsLoading(false);
  };

  const handleRemoveUser = async (email: string) => {
    setIsRemovingUser(true);

    const updatedEmails = emails.filter((e) => e !== email);

    const success = await updateFileUsers({
      fileId: file.$id,
      emails: updatedEmails,
      path: pathname,
    });

    if (success) setEmails(updatedEmails);

    closeAllModel();
    setIsRemovingUser(false);
  };

  const renderDialogContent = () => {
    if (!action) return null;

    const { value, label } = action;
    return (
      <DialogContent className="shad-dialog button">
        <DialogHeader className="flex flex-col gap-3">
          <DialogTitle className="text-center text-light-100">
            {label}
          </DialogTitle>
          {value === "rename" && (
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          {value === "details" && <FileDetails file={file} />}
          {value === "share" && (
            <ShareInput
              file={file}
              onInputChange={setEmails}
              onRemove={handleRemoveUser}
              isLoading={isRemovingUser}
            />
          )}
          {value === "delete" && (
            <p className="delete-confirmation">
              Are you sure that you want to delete{" "}
              <span className="delete-file-name">{file.name}</span>?
            </p>
          )}
          <DialogDescription />
        </DialogHeader>

        {["rename", "delete", "share"].includes(value) && (
          <DialogFooter className="flex flex-col gap-3 md:flex-row">
            <Button
              disabled={isLoading}
              onClick={closeAllModel}
              className="modal-cancel-button"
            >
              Cancel
            </Button>
            <Button
              disabled={isLoading}
              onClick={handleAction}
              className="modal-submit-button"
            >
              <p className="capitalize">{value}</p>
              {isLoading && <Loader2 className="ml-2 animate-spin" />}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger className="shad-no-focus">
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="max-w-[200px] truncate">
            {file.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actionsDropdownItems.map((item) => {
            return (
              <DropdownMenuItem
                key={item.value}
                className="shad-dropdown-item"
                onClick={() => {
                  setAction(item);

                  if (
                    ["rename", "delete", "share", "details"].includes(
                      item.value,
                    )
                  ) {
                    setIsOpen(true);
                  }
                }}
              >
                {item.value === "download" ? (
                  <Link
                    href={constructDownloadUrl(file.bucketFileId)}
                    download={file.name}
                    className="flex items-center gap-2"
                  >
                    {React.createElement(item.icon, { className: "size-4" })}
                    <p>{item.label}</p>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    {React.createElement(item.icon, { className: "size-4" })}
                    <p>{item.label}</p>
                  </div>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {renderDialogContent()}
    </Dialog>
  );
};

export default ActionDropdown;

"use server";

import { createAdminClient, createSessionClient } from "../appwrite";
import { ID, Models, Query } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { appwriteConfig } from "../appwrite/config";
import { constructFileUrl, getFileType, parseStringify } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./user.actions";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);

  throw error;
};

/**
 * Upload a file to the given path.
 * @param {UploadFileProps} props - The file to upload, the owner's ID, the account ID, and the path to revalidate.
 * @returns {Promise<Models.Document>} The uploaded file's document.
 */
export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: UploadFileProps) => {
  const { storage, databases } = await createAdminClient();

  try {
    const inputFile = InputFile.fromBuffer(file, file.name);

    const bucketFile = await storage.createFile(
      appwriteConfig.bucketCollection,
      ID.unique(),
      inputFile,
    );

    const fileDocument = {
      type: getFileType(bucketFile.name).type,
      name: bucketFile.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(bucketFile.name).extension,
      size: bucketFile.sizeOriginal,
      owner: ownerId,
      accountId,
      users: [],
      bucketFileId: bucketFile.$id,
    };

    const newFile = await databases
      .createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.filesCollection,
        ID.unique(),
        fileDocument,
      )
      .catch(async (error: unknown) => {
        await storage.deleteFile(
          appwriteConfig.bucketCollection,
          bucketFile.$id,
        );

        handleError(error, "Failed to upload document");
      });

    revalidatePath(path);

    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

/**
 * Create the queries to list the files accessible to the current user.
 * @param {Models.Document} currentUser - The current user document.
 * @returns {Promise<Query[]>} A promise that resolves to an array of queries.
 * @throws Will throw an error if any of the queries fail.
 */
export const createQueries = async (
  currentUser: Models.Document,
  types: string[],
  searchText?: string,
  sort?: string,
  limit?: number,
) => {
  const queries = [
    Query.or([
      Query.equal("owner", [currentUser.$id]),
      Query.contains("users", [currentUser.email]),
    ]),
  ];

  // This line will make the files type appear in the specific page.
  if (types.length > 0) queries.push(Query.equal("type", types));

  // This line will make the user be able to search for a specific file.
  if (searchText) queries.push(Query.search("name", searchText));

  // This line will make the user be able to limit the number of files.
  if (limit) queries.push(Query.limit(limit));

  // This line will make the user be able to sort the files.
  const [sortBy, orderBy] = sort?.split("-") ?? [];

  queries.push(
    orderBy === "asc" ? Query.orderAsc(sortBy) : Query.orderDesc(sortBy),
  );

  // Todo: Search, sort, limits

  return queries;
};

/**
 * Retrieve a list of files accessible to the current user.
 * @returns {Promise<Models.Document[]>} A promise that resolves to an array of file documents.
 * @throws Will throw an error if the user is not found or if retrieval fails.
 */
export const getFiles = async ({
  types = [],
  searchText = "",
  sort = "$createdAt-desc",
  limit,
}: GetFilesProps) => {
  const { databases } = await createAdminClient();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not found!");

    const queries = createQueries(currentUser, types, searchText, sort, limit);

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      await queries,
    );

    return parseStringify(files);
  } catch (error) {
    handleError(error, "Failed to get the files!");
  }
};

export const renameFile = async ({
  fileId,
  name,
  extension,
  path,
}: RenameFileProps) => {
  const { databases } = await createAdminClient();

  try {
    const newName = `${name}.${extension}`;

    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      fileId,
      { name: newName },
    );

    revalidatePath(path);

    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename the file!");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const { databases } = await createAdminClient();

  try {
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      fileId,
      { users: emails },
    );

    revalidatePath(path);

    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename the file!");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  const { databases, storage } = await createAdminClient();

  try {
    const deletedDocument = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      fileId,
    );

    let deletedFile = null;

    if (deletedDocument) {
      deletedFile = await storage.deleteFile(
        appwriteConfig.bucketCollection,
        bucketFileId,
      );
    }

    await revalidatePath(path);

    return parseStringify({ deletedDocument, deletedFile });
  } catch (error) {
    handleError(error, "Failed to delete this file");
    return null;
  }
};

export async function getTotalSpaceUsed() {
  try {
    const { databases } = await createSessionClient();
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      [Query.equal("owner", [currentUser.$id])],
    );

    const totalSpace = {
      image: { size: 0, latestDate: "" },
      document: { size: 0, latestDate: "" },
      video: { size: 0, latestDate: "" },
      audio: { size: 0, latestDate: "" },
      other: { size: 0, latestDate: "" },
      used: 0,
      all: 2 * 1024 * 1024 * 1024 /* 2GB available bucket storage */,
    };

    files.documents.forEach((file) => {
      const fileType = file.type as FileType;
      totalSpace[fileType].size += file.size;
      totalSpace.used += file.size;

      if (
        !totalSpace[fileType].latestDate ||
        new Date(file.$updatedAt) > new Date(totalSpace[fileType].latestDate)
      ) {
        totalSpace[fileType].latestDate = file.$updatedAt;
      }
    });

    return parseStringify(totalSpace);
  } catch (error) {
    handleError(error, "Error calculating total space used:, ");
  }
}

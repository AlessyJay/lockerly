"use server";

import { createAdminClient } from "../appwrite";
import { Databases, ID, Models, Query } from "node-appwrite";
import { z } from "zod";
import { appwriteConfig } from "../appwrite/config";
import { constructFileUrl, getFileType, parseStringify } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./user.actions";

// node-appwrite 17+ only returns relationships you select; the UI and getOwnedFile need owner.
const ownerSelect = Query.select(["*", "owner.*"]);

// A `never` function declaration, so callers' return types don't include `undefined` from the catch path.
function handleError(error: unknown, message: string): never {
  console.log(error, message);

  throw error;
}

// Server actions are public endpoints, so every mutation re-checks the session and ownership here.
const getOwnedFile = async (fileId: string) => {
  const currentUser = await getCurrentUser();

  if (!currentUser) throw new Error("User not found!");

  const { databases } = await createAdminClient();

  const file = await databases.getDocument(
    appwriteConfig.databaseId,
    appwriteConfig.filesCollection,
    fileId,
    [ownerSelect],
  );

  if (file.owner?.$id !== currentUser.$id) throw new Error("Not allowed!");

  return file;
};

// shortcut: loads every matching file in pages of 100, add UI pagination if users get thousands of files
const listAllFiles = async (databases: Databases, queries: string[]) => {
  const documents: Models.DefaultDocument[] = [];
  let page: Models.DocumentList<Models.DefaultDocument>;

  do {
    page = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      [...queries, Query.limit(100), Query.offset(documents.length)],
    );

    documents.push(...page.documents);
  } while (page.documents.length === 100);

  return { total: documents.length, documents };
};

/**
 * A short-lived token that lets the browser upload straight to the bucket
 * (the bucket allows `create("users")`), so the uploader can show real progress.
 */
export const getUploadToken = async () => {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not found!");

    const { users } = await createAdminClient();

    const { jwt } = await users.createJWT(currentUser.accountId, undefined, 900);

    return jwt;
  } catch (error) {
    handleError(error, "Failed to create an upload token");
  }
};

/**
 * Save the Files document for a file the browser already uploaded to the bucket.
 * @param {UploadFileProps} props - The bucket file id and the path to revalidate.
 * @returns {Promise<Models.DefaultDocument>} The uploaded file's document.
 */
export const uploadFile = async ({ bucketFileId, path }: UploadFileProps) => {
  const { storage, databases } = await createAdminClient();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not found!");

    const bucketFile = await storage.getFile(
      appwriteConfig.bucketCollection,
      bucketFileId,
    );

    // Appwrite grants the uploading user these permissions, so only the uploader can save it.
    if (
      !bucketFile.$permissions.includes(
        `delete("user:${currentUser.accountId}")`,
      )
    )
      throw new Error("Not allowed!");

    const alreadySaved = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      [Query.equal("bucketFileId", [bucketFileId]), Query.limit(1)],
    );

    if (alreadySaved.total > 0) throw new Error("File is already saved!");

    const fileDocument = {
      type: getFileType(bucketFile.name).type,
      name: bucketFile.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(bucketFile.name).extension,
      size: bucketFile.sizeOriginal,
      owner: currentUser.$id,
      accountId: currentUser.accountId,
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
 * @param {Models.DefaultDocument} currentUser - The current user document.
 * @returns {Promise<Query[]>} A promise that resolves to an array of queries.
 * @throws Will throw an error if any of the queries fail.
 */
export const createQueries = async (
  currentUser: Models.DefaultDocument,
  types: string[],
  searchText?: string,
  sort?: string,
  limit?: number,
) => {
  const queries = [
    ownerSelect,
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

  return queries;
};

/**
 * Retrieve a list of files accessible to the current user.
 * Without a limit, every matching file is returned.
 * @returns {Promise<Models.DefaultDocument[]>} A promise that resolves to an array of file documents.
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

    const queries = await createQueries(
      currentUser,
      types,
      searchText,
      sort,
      limit,
    );

    const files = limit
      ? await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.filesCollection,
          queries,
        )
      : await listAllFiles(databases, queries);

    return parseStringify(files);
  } catch (error) {
    handleError(error, "Failed to get the files!");
  }
};

export const renameFile = async ({ fileId, name, path }: RenameFileProps) => {
  const { databases } = await createAdminClient();

  try {
    const file = await getOwnedFile(fileId);

    const baseName = name.trim();

    if (!baseName) throw new Error("File name is required!");

    // The rename input starts with the full name, so only add the extension if it's missing.
    const newName =
      !file.extension ||
      baseName.toLowerCase().endsWith(`.${file.extension}`)
        ? baseName
        : `${baseName}.${file.extension}`;

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

/** Replace the file's shared-with list. Callers send the full list, not just new emails. */
export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const { databases } = await createAdminClient();

  try {
    const validEmails = z.array(z.string().email()).parse(emails);

    await getOwnedFile(fileId);

    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      fileId,
      { users: [...new Set(validEmails)] },
    );

    revalidatePath(path);

    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to share the file!");
  }
};

export const deleteFile = async ({ fileId, path }: DeleteFileProps) => {
  const { databases, storage } = await createAdminClient();

  try {
    const file = await getOwnedFile(fileId);

    const deletedDocument = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollection,
      fileId,
    );

    let deletedFile = null;

    if (deletedDocument) {
      deletedFile = await storage.deleteFile(
        appwriteConfig.bucketCollection,
        file.bucketFileId,
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
    const { databases } = await createAdminClient();
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const files = await listAllFiles(databases, [
      Query.equal("owner", [currentUser.$id]),
    ]);

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

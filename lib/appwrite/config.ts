export const appwriteConfig = {
  endpointUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT!,
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE!,
  usersCollection: process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION!,
  filesCollection: process.env.NEXT_PUBLIC_APPWRITE_FILES_COLLECTION!,
  bucketCollection: process.env.NEXT_PUBLIC_APPWRITE_BUCKET!,
  secretKey: process.env.NEXT_APPWRITE_SECRET!,
};

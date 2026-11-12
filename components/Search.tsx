"use client";

import { SearchIcon, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getFiles } from "@/lib/actions/file.actions";
import { Models } from "node-appwrite";
import Thumbnail from "./Thumbnail";
import FormattedDateTime from "./FormattedDateTime";
import { useDebounce } from "use-debounce";

const Search = () => {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("query") || "";
  const [query, setQuery] = useState<string>(searchQuery);
  const [result, setResult] = useState<Models.DefaultDocument[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const path = usePathname();

  const [debounceQuery] = useDebounce(query, 1000);

  // Runs only when the typed text settles. Re-running on URL changes reopened
  // the dropdown after picking a result and stripped ?query= on page load.
  useEffect(() => {
    const fetchFile = async () => {
      if (debounceQuery.length === 0) {
        setResult([]);
        setOpen(false);

        // Clear the page filter only if one is applied.
        if (!searchQuery) return;

        const currentSort = searchParams.get("sort");
        const updateUrl = currentSort ? `${path}?sort=${currentSort}` : path;

        return router.push(updateUrl);
      }

      // Already applied as the page filter (page load or a picked result).
      if (debounceQuery === searchQuery) return;

      setLoading(true);
      setOpen(true);

      try {
        const files = await getFiles({ types: [], searchText: debounceQuery });

        setResult(files.documents);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceQuery]);

  useEffect(() => {
    if (!searchQuery) {
      setQuery("");
    }
  }, [searchQuery]);

  const handleClick = (file: Models.DefaultDocument) => {
    setOpen(false);
    setResult([]);

    router.push(
      `/${file.type === "video" || file.type === "audio" ? "media" : file.type + "s"}?query=${encodeURIComponent(query)}`,
    );
  };

  return (
    <div className="search">
      <div className="search-input-wrapper">
        <SearchIcon />

        <Input
          value={query}
          placeholder="Search...."
          className="search-input"
          onChange={(e) => setQuery(e.target.value)}
        />

        {open && (
          <ul className="search-result">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-4">
                <Loader2 className="size-6 animate-spin text-neutral-500" />
                Loading results...
              </div>
            ) : result.length > 0 ? (
              result.map((file) => (
                <li
                  className="flex items-center justify-between"
                  key={file.$id}
                  onClick={() => handleClick(file)}
                >
                  <div className="flex w-full cursor-pointer items-center gap-4 rounded-md p-2 hover:bg-neutral-100">
                    <Thumbnail
                      extension={file.extension}
                      type={file.type}
                      url={file.url}
                      className="size-9 min-w-9"
                    />

                    <p className="subtitle-2 line-clamp-1 text-light-100">
                      {file.name}
                    </p>

                    <FormattedDateTime
                      date={file.$createdAt}
                      className="caption line-clamp-1 text-light-200"
                    />
                  </div>
                </li>
              ))
            ) : (
              <p className="empty-result">No results</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Search;

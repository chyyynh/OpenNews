import { createClient, PostgrestError } from "@supabase/supabase-js";
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { RefreshOnNewArticle } from "@/components/RefreshOnNewArticle"; // 假設你放這路徑

interface ArticleItem {
  id: number;
  title: string;
  url: string;
  published_date: string;
  tags: string[];
  summary: string | null; // Add summary field
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Throw an error during build/startup if env vars are missing in Server Components
  throw new Error(
    "Supabase URL or Anon Key is missing. Make sure they are set in your environment variables."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Make the function async and await the result
async function getTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("tags")
    .limit(2000);

  if (error) {
    console.error("Error fetching tags:", error);
    throw error; // Throw error to be caught by Error Boundary or use()
  }

  const allTags = data
    ? data.flatMap((item: { tags: string[] | null }) => item.tags || [])
    : [];
  const uniqueTags = [...new Set(allTags.filter(Boolean))];
  return uniqueTags.sort(); // Return the data directly
}

async function getArticles(
  selectedTags: string[]
): Promise<
  | { articles: ArticleItem[]; error: null }
  | { articles: []; error: PostgrestError }
> {
  // Return type indicates either success or error state clearly
  let query = supabase
    .from("articles")
    .select("id, title, url, published_date, tags, summary") // Select summary
    .order("published_date", { ascending: false });

  // Use 'overlaps' operator to find articles matching ANY selected tag (union)
  if (selectedTags.length > 0) {
    query = query.overlaps("tags", selectedTags);
  }

  query = query.limit(20); // Keep the limit

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching articles:", error);
    // Return an object indicating error, don't throw here if handling in component
    return { articles: [], error };
  }

  // Return the data directly on success
  return { articles: (data as ArticleItem[]) || [], error: null };
}

type SearchParams = { [key: string]: string | string[] | undefined };

// Page component is now synchronous (no 'async' keyword)
export default function Home(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = use(props.searchParams);
  // Read multiple tags from the 'tags' query parameter
  const selectedTagsString =
    typeof searchParams?.tags === "string" ? searchParams.tags : "";
  const selectedTags = selectedTagsString ? selectedTagsString.split(",") : [];

  // Resolve data fetching promises using the async functions
  const tags = use(getTags());
  const { articles, error: fetchError } = use(getArticles(selectedTags));

  // Helper function to generate the href for tag toggling
  const getToggleTagHref = (tag: string): string => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    if (newSelectedTags.length === 0) {
      return "/";
    }
    return `/?tags=${newSelectedTags.map(encodeURIComponent).join(",")}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <RefreshOnNewArticle />

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Latest News{" "}
          {selectedTags.length > 0 ? ` - Tags: ${selectedTags.join(", ")}` : ""}
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column (Articles List) */}
        <main className="md:col-span-2 flex flex-col gap-4">
          {/* Display error if fetchError occurred */}
          {fetchError && (
            <p className="text-red-500">
              Could not fetch articles. Error:{" "}
              {fetchError.message || "Unknown error"}
            </p>
          )}
          {/* Display articles if no error and articles exist */}
          {!fetchError && articles && articles.length > 0 ? (
            <ul className="space-y-4">
              {articles.map((item: ArticleItem) => (
                <li
                  key={item.id}
                  className="border rounded-lg p-4 shadow hover:shadow-md transition-shadow overflow-auto"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <h2 className="text-xl font-semibold mb-1">{item.title}</h2>
                  </a>
                  {/* Display summary if it exists, limited to 3 lines */}
                  {item.summary && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                      {item.summary}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 mt-2">
                    {" "}
                    {/* Added mt-2 for spacing */}
                    <span>
                      Published:
                      {new Date(item.published_date).toLocaleDateString()}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <span className="ml-2">
                        | Tags: {item.tags.join(", ")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            // Display message if no articles found and no error
            !fetchError && (
              <p>
                No articles found
                {selectedTags.length > 0
                  ? ` for tags: "${selectedTags.join(", ")}"`
                  : ""}
                .
              </p>
            )
          )}
        </main>

        {/* Right Column (Tag Filters) */}
        <aside className="md:col-span-1 border-l md:pl-6">
          <h2 className="text-xl font-semibold mb-4">Filter by Tag</h2>
          <div className="flex flex-wrap gap-2">
            {/* "All Tags" button clears selection */}
            <Link href="/" passHref>
              <Button
                variant={selectedTags.length === 0 ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                All Tags
              </Button>
            </Link>
            {/* Tag buttons toggle selection */}
            {tags.map((tag) => (
              <Link href={getToggleTagHref(tag)} key={tag} passHref>
                <Button
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                >
                  {tag}
                </Button>
              </Link>
            ))}
            {tags.length === 0 && !fetchError && (
              <p className="text-sm text-gray-500">No tags found.</p>
            )}
          </div>
        </aside>
      </div>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        Powered by Next.js and Supabase
      </footer>
    </div>
  );
}

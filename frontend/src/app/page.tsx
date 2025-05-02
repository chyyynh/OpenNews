import { createClient, PostgrestError } from "@supabase/supabase-js"; // Import PostgrestError
import Link from "next/link";
import { use } from "react";

interface ArticleItem {
  id: number;
  title: string;
  url: string;
  published_date: string;
  tags: string[];
}

// Create Supabase client - ensure env vars are set
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

// Make the function async and await the result
async function getArticles(
  selectedTag: string | null
): Promise<
  | { articles: ArticleItem[]; error: null }
  | { articles: []; error: PostgrestError }
> {
  // Return type indicates either success or error state clearly
  let query = supabase
    .from("articles")
    .select("id, title, url, published_date, tags")
    .order("published_date", { ascending: false });

  if (selectedTag) {
    query = query.contains("tags", [selectedTag]);
  }

  query = query.limit(20);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching articles:", error);
    // Return an object indicating error, don't throw here if handling in component
    return { articles: [], error };
  }

  // Return the data directly on success
  return { articles: (data as ArticleItem[]) || [], error: null };
}

// Define the type for searchParams if using the Promise pattern
type SearchParams = { [key: string]: string | string[] | undefined };

// Page component is now synchronous (no 'async' keyword)
export default function Home(props: { searchParams: Promise<SearchParams> }) {
  // Resolve searchParams promise
  const searchParams = use(props.searchParams);
  const selectedTag =
    typeof searchParams?.tag === "string" ? searchParams.tag : null;

  // Resolve data fetching promises using the async functions
  // Note: Error handling for use() typically involves Error Boundaries
  // Consider wrapping parts of the component in <Suspense> if needed
  const tags = use(getTags()); // Call the async function directly
  const { articles, error: fetchError } = use(getArticles(selectedTag)); // Call the async function

  return (
    <div className="container mx-auto p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Latest News {selectedTag ? ` - Tag: ${selectedTag}` : ""}
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
                  className="border rounded-lg p-4 shadow hover:shadow-md transition-shadow"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <h2 className="text-xl font-semibold mb-1">{item.title}</h2>
                  </a>
                  <div className="text-sm text-gray-500 mt-1">
                    <span>
                      Published:{" "}
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
                No articles found{" "}
                {selectedTag ? ` for tag "${selectedTag}"` : ""}.
              </p>
            )
          )}
        </main>

        {/* Right Column (Tag Filters) */}
        <aside className="md:col-span-1 border-l md:pl-6">
          <h2 className="text-xl font-semibold mb-4">Filter by Tag</h2>
          {/* Consider adding error handling for tags fetch if needed */}
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                className={`block hover:underline ${
                  !selectedTag ? "font-bold" : ""
                }`}
              >
                All Tags
              </Link>
            </li>
            {tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/?tag=${encodeURIComponent(tag)}`}
                  className={`block hover:underline ${
                    selectedTag === tag ? "font-bold" : ""
                  }`}
                >
                  {tag}
                </Link>
              </li>
            ))}
            {tags.length === 0 && !fetchError && <li>No tags found.</li>}
          </ul>
        </aside>
      </div>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        Powered by Next.js and Supabase
      </footer>
    </div>
  );
}

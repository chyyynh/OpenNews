import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// Define the type for an article item
interface ArticleItem {
  // Renamed from NewsItem
  id: number;
  title: string;
  url: string;
  published_date: string; // Changed from created_at
  tags: string[];
}

// Create Supabase client - ensure env vars are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing. Make sure they are set in your environment variables."
  );
  // Handle missing env vars appropriately
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to fetch distinct tags from the tags array column
async function getTags(): Promise<string[]> {
  // Fetch all rows and their tags arrays. This might be inefficient for very large tables.
  // Consider creating a separate table or view for tags if performance becomes an issue.
  const { data, error } = await supabase
    .from("articles") // Changed from "news"
    .select("tags") // Select the tags array column
    .limit(2000); // Adjust limit as needed, fetching more rows to get diverse tags

  if (error) {
    console.error("Error fetching tags:", error);
    return [];
  }

  // Flatten all tags arrays, filter out null/empty tags, get unique values
  const allTags = data
    ? data.flatMap((item: { tags: string[] | null }) => item.tags || [])
    : [];
  const uniqueTags = [...new Set(allTags.filter(Boolean))];
  return uniqueTags.sort(); // Sort tags alphabetically
}

// Page component now accepts searchParams for 'tag'
export default async function Home({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // Read 'tag' from searchParams instead of 'topic'
  const selectedTag =
    typeof searchParams?.tag === "string" ? searchParams.tag : null;

  // Fetch article data from Supabase, potentially filtered by tag
  let articles: ArticleItem[] | null = null; // Renamed from news, updated type
  let fetchError: any = null;
  let query = supabase
    .from("articles") // Changed from "news"
    .select("id, title, url, published_date, tags") // Changed created_at to published_date
    .order("published_date", { ascending: false }); // Changed created_at to published_date

  // Apply tag filter if selected using array contains operator '@>'
  if (selectedTag) {
    // Use contains operator for array filtering
    query = query.contains("tags", [selectedTag]);
  }

  query = query.limit(20); // Limit the number of items fetched

  try {
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    articles = data; // Renamed from news
  } catch (error) {
    console.error("Error fetching articles:", error); // Updated log message
    fetchError = error;
  }

  // Fetch unique tags for the filter list
  const tags = await getTags();

  return (
    <div className="container mx-auto p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Latest News {selectedTag ? ` - Tag: ${selectedTag}` : ""}
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column (News List) */}
        <main className="md:col-span-2 flex flex-col gap-4">
          {fetchError && (
            <p className="text-red-500">
              Could not fetch articles. Error: // Updated message
              {fetchError.message || "Unknown error"}
            </p>
          )}
          {!fetchError && articles && articles.length > 0 ? ( // Renamed news to articles
            <ul className="space-y-4">
              {articles.map(
                (
                  item: ArticleItem // Renamed news to articles, updated type
                ) => (
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
                      <h2 className="text-xl font-semibold mb-1">
                        {item.title}
                      </h2>
                    </a>
                    <div className="text-sm text-gray-500 mt-1">
                      <span>
                        Published:{" "}
                        {new Date(item.published_date).toLocaleDateString()}{" "}
                        {/* Changed created_at to published_date */}
                      </span>
                      {item.tags && item.tags.length > 0 && (
                        <span className="ml-2">
                          | Tags: {item.tags.join(", ")}
                        </span>
                      )}
                    </div>
                  </li>
                )
              )}
            </ul>
          ) : (
            !fetchError && (
              <p>
                No articles found {/* Updated message */}
                {selectedTag ? ` for tag "${selectedTag}"` : ""}.
              </p>
            )
          )}
        </main>

        {/* Right Column (Tag Filters) */}
        <aside className="md:col-span-1 border-l md:pl-6">
          <h2 className="text-xl font-semibold mb-4">Filter by Tag</h2>
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
                {/* Update link to use ?tag= */}
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

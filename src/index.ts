export interface Env {
  // Add bindings here if you need them later
}

const MEME_SOURCE_URL = "https://www.memedroid.com/memes/tag/programming";

/**
 * Scrape the meme page and extract image URLs.
 * Equivalent idea to get_new_memes() in the Python version.
 */
async function getNewMemes(): Promise<string[]> {
    const response = await fetch(MEME_SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch meme page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Very simple HTML extraction:
  // Look for: <div class="item-aux-container"> ... <img ... src="...jpeg"
  const imgs: string[] = [];
  const regex =
    /<div[^>]*class="[^"]*item-aux-container[^"]*"[\s\S]*?<img[^>]+src="([^"]+?\.jpeg)"/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith("http") && src.endsWith("jpeg")) {
      imgs.push(src);
    }
  }

  if (imgs.length === 0) {
    throw new Error("No meme images found");
  }

  return imgs;
}

/**
 * Choose a random element from an array.
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Fetch a random meme image and return it as a Response.
 * This is roughly equivalent to return_meme() + serve_pil_image() in Python,
 * but we just proxy the original JPEG instead of re-encoding it.
 */
async function returnMeme(): Promise<Response> {
  const memeUrls = await getNewMemes();
  const imgUrl = randomChoice(memeUrls);

  const imgResp = await fetch(imgUrl);

  if (!imgResp.ok || !imgResp.body) {
    throw new Error(`Failed to fetch meme image: ${imgResp.status} ${imgResp.statusText}`);
  }

  // Start from scratch to control headers
  const headers = new Headers();
  headers.set("Content-Type", "image/jpeg");
  // Match your no-cache behavior
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");

  return new Response(imgResp.body, {
    status: 200,
    headers,
  });
}

export default {
  /**
   * Cloudflare Worker entrypoint.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" || url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    try {
      return await returnMeme();
    } catch (err: any) {
      console.error("Error serving meme:", err);
      return new Response("Error fetching meme", { status: 500 });
    }
  },
};

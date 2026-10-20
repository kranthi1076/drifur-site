// DRIFUR voice shopping assistant — Netlify Function
// Endpoint: /.netlify/functions/drifur-assistant
// Needs env var ANTHROPIC_API_KEY (Netlify → Site configuration → Environment variables)

// ---- Edit these when product details change ----
const CONFIG = {
  model: "claude-haiku-5-5", // fast + cheap, good for voice
  maxTokens: 220,
  product: {
    name: "DRIFUR 3-in-1 Pet Hair Remover Kit for Cats and Dogs",
    price: "$16.99 on Amazon",
    rating: "Rated 4.6 out of 5 on Amazon",
    contents: [
      "Self-cleaning deshedding brush — for grooming loose undercoat off your pet",
      "Stainless steel grooming comb — wide teeth to work through thicker and longer coats, fine teeth to finish",
      "Reusable lint roller — roll back and forth over couches, bedding, rugs, throws, clothes and car seats; dog and cat hair collects in a chamber you empty into the bin in one go",
    ],
    goodFor: "both cats and dogs, including long-haired cats. Brush gently in the direction of the coat and go gently around tangles.",
    extras: [
      "All three tools are reusable: no sticky sheets, batteries or charging.",
      "Comes in a black-and-gold box that's ready to give as a gift, no wrapping needed.",
    ],
    buying: "Sold on Amazon and ships with Prime for Prime members. Returns follow Amazon's return policy for this item.",
    support: "support@drifur.shop",
  },
};

const SYSTEM = `You are the voice shopping assistant on drifur.com for DRIFUR, a pet hair removal brand.

PRODUCT FACTS (the only facts you may state):
- Product: ${CONFIG.product.name}
- Price: ${CONFIG.product.price}
- What's in the kit:
${CONFIG.product.contents.map((c) => "  • " + c).join("\n")}
- Rating: ${CONFIG.product.rating}
- Good for: ${CONFIG.product.goodFor}
${CONFIG.product.extras.map((e) => "- " + e).join("\n")}
- Buying: ${CONFIG.product.buying}
- Customer support email: ${CONFIG.product.support}

HOW TO ANSWER (your reply is read aloud):
- 1 to 3 short sentences, under 60 words. Warm, confident, plain spoken English.
- No lists, markdown, emoji or URLs. When someone is ready to buy, tell them to tap "Buy on Amazon" on screen.
- Never invent specs, sizes, materials, warranties, discounts or delivery dates. If you don't know, say so and suggest emailing support (say "support at drifur dot shop").
- Don't name or compare against other brands or products.
- No veterinary or medical advice; for skin, sores or heavy hair loss, suggest seeing a vet.
- If asked something unrelated to DRIFUR or pet hair, answer briefly and steer back.
- Gently guide toward buying when it fits, without being pushy.`;

const FALLBACK =
  "Sorry, I'm having trouble right now. You can tap Buy on Amazon for full details, or email support at drifur dot shop.";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Keep only clean, short, recent turns so nobody can run up the API bill
function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 500) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("ANTHROPIC_API_KEY is not set");
    return json({ reply: FALLBACK }, 200);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const messages = sanitize(body && body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "Bad request" }, 400);
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        system: SYSTEM,
        messages,
      }),
    });

    if (!r.ok) {
      console.error("Anthropic API error", r.status, await r.text());
      return json({ reply: FALLBACK }, 200);
    }

    const data = await r.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    return json({ reply: reply || FALLBACK });
  } catch (err) {
    console.error("Assistant failed", err);
    return json({ reply: FALLBACK }, 200);
  }
};

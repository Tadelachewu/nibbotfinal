# Writing menu & article content for the AI Knowledge Base

Every static menu page and knowledge article you write gets automatically split into
chunks, embedded, and indexed so the "Ask AI" feature can retrieve and answer from it.
How you structure the content directly determines whether the AI finds the right
answer. These rules come from real retrieval failures found and fixed in this system —
each one maps to a specific bug that bad content structure caused.

For the technical config side (top-K, confidence thresholds, models, reranker
settings), see `AI_CONFIG.md` instead — this document is about writing content,
not tuning the retrieval pipeline.

## 1. Use a heading (H2/H3) for every distinct topic

The indexer treats each heading as a hard boundary — content under different headings
is **never** merged into the same retrievable chunk, and content under the *same*
heading always travels together. This is the single most important rule.

- **Do**: put "Core Values" and "Scale" under separate `<h3>` headings.
- **Don't**: write multiple unrelated topics as plain paragraphs with no heading
  between them — the system has no way to know they're unrelated, and a chunk
  boundary falling in the wrong place can blend two topics into one answer
  (this exact bug caused the AI to list "Scale" as one of the bank's "Core Values").

You don't need to repeat the page name or bank name in every section — the system
automatically attaches the page's title to every section it indexes, so "Core Values"
doesn't need to restate "About NIB" itself.

## 2. One fact per list item

Use a separate bullet for every separate fact. Don't combine two values into one line
("Collaboration, Diversity" as a single bullet) — keep them as two `<li>` items. Each
list item is preserved as its own unit through indexing; combining facts into one line
makes it more likely the AI reports them as a single item to the user.

## 3. Write facts as complete phrases, not bare fragments

A list of bare one-or-two-word fragments ("Diversity", "Value for Money") embeds and
retrieves less reliably than the same information as a short natural sentence. Where
practical, prefer:

> "We value diversity in the workplace."

over a bare bullet reading only "Diversity" — especially for content you expect people
to ask direct questions about ("What are NIB's core values?"). Bulleted lists are fine
and normal; just avoid single-word or near-single-word items when you can phrase them
as short sentences instead.

## 4. Keep sections a reasonable length

Very long, un-headed blocks of text get mechanically split by size, which can cut a
thought in the wrong place. If a topic naturally runs long, break it into sub-headings
rather than one giant paragraph.

## 5. Never paste AI chat output, drafts, or placeholder text into live content

If you used an AI tool (including this system's own "AI content suggester") to draft
content, review and clean it before publishing. Leftover conversational text —
"Given your earlier questions about integrating your chatbot...", "Let me know if you
want more detail," etc. — has ended up baked into live page content before. The AI
will treat it as real, retrievable bank information and may surface it to users.

## 6. Write exact, unambiguous numbers and dates

Always write full dates with the year ("May 26, 1999", not "May 26" or "5/26/99") and
exact figures ("Birr 27.6 million", not "~28 million"). The AI is instructed to quote
numbers and dates exactly as written in your content — if the source is vague or
inconsistent, the answer will be too.

## 7. Rebuild the index after editing

Saving content doesn't index it by itself for menus pending checker approval — it
takes effect once approved (or immediately for admin-forced reindex). After a content
change goes live, check **Admin → Knowledge Base → Status** to confirm the chunk count
updated and "Last indexed" is recent. If it looks stale, use **Rebuild All**.

## 8. Multi-language content

Fill in the Amharic (or other) translation fields when available, not just English.
Keyword-based (lexical) search currently only benefits from English's dictionary-aware
matching — other languages rely more heavily on semantic (vector) matching alone, so
precise, well-structured content matters even more for non-English answers.

## 9. Avoid pasting formatted text directly from Word/Google Docs

Pasting from external editors can carry over inline styles and unusual markup that
add noise without adding meaning. Prefer typing directly in the editor or pasting as
plain text, then applying formatting (headings, bold, lists) with the editor's own
toolbar.

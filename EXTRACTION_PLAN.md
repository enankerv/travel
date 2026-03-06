# Villa Scout: Structured Extraction Workflow (Plan)

## Goal

Replace free-form LLM summarization with **structured extraction** (Pydantic + Instructor), then optionally generate the narrative report from that data. Benefits:

- **Structured data** for comparison, filtering, or API use
- **Validation** and retries when the LLM misses a required field
- **Semantic stability**: layout/class changes on sites don’t break extraction
- **USD conversion** and “one property only” enforced in one place

---

## 1. Define Pydantic Schema(s)

Use `Field(description=...)` so the LLM knows what to find in the markdown.

**Option A – Single extraction model (recommended first step)**

```python
# schema.py (or in scout.py)
from pydantic import BaseModel, Field
from typing import List, Optional

class VillaListing(BaseModel):
    villa_name: str = Field(description="The official name of the property")
    location: str = Field(description="Region or town in Italy (e.g. Tuscany, Cetona)")
    region: Optional[str] = Field(default=None, description="Region only if distinct from location")
    max_guests: Optional[int] = Field(default=None, description="Maximum number of guests")
    bedrooms: Optional[int] = Field(default=None, description="Total number of bedrooms")
    bathrooms: Optional[int] = Field(default=None, description="Total number of bathrooms")
    price_weekly_min_eur: Optional[float] = Field(default=None, description="Lowest weekly rate in EUR from the listing")
    price_weekly_max_eur: Optional[float] = Field(default=None, description="Highest weekly rate in EUR from the listing")
    price_weekly_usd: Optional[str] = Field(default=None, description="Weekly price range in USD, e.g. '~$6,400–9,600 USD/week'")
    security_deposit_eur: Optional[float] = Field(default=None, description="Security deposit in EUR if stated")
    pool_features: List[str] = Field(default_factory=list, description="Pool details: infinity, heated, dimensions, salt water, etc.")
    amenities: List[str] = Field(default_factory=list, description="Key features: AC, WiFi, kitchen, BBQ, pizza oven, etc.")
    interiors_summary: Optional[str] = Field(default=None, description="Short summary of layout and rooms")
    exteriors_summary: Optional[str] = Field(default=None, description="Short summary of garden, terraces, views")
    location_summary: Optional[str] = Field(default=None, description="Nearby towns, motorway exit, driving times")
    extras: List[str] = Field(default_factory=list, description="Extras: chef, tours, winetasting, etc.")
    included_in_price: List[str] = Field(default_factory=list, description="What is included (linen, cleaning, etc.)")
    not_included: List[str] = Field(default_factory=list, description="What is not included (final cleaning, heating, etc.)")
    the_catch: Optional[str] = Field(default=None, description="Cons or important caveats (steps, gravel road, no pets, etc.)")
```

**Option B – Seasonal pricing (if you need it)**

- Add a nested model and use **Markdown-KV** for the rates table (see step 4):

```python
class RatePeriod(BaseModel):
    period: str = Field(description="E.g. 'Jan 3 - March 28, 2026'")
    price_eur: Optional[float] = None
    price_usd: Optional[str] = None

class VillaListingWithRates(VillaListing):
    seasonal_rates: List[RatePeriod] = Field(default_factory=list, description="Weekly rates by period from the listing table")
```

Start with Option A; add Option B when you need comparison by period.

---

## 2. Format Input with XML Delimiters

In the **user** message, wrap the pruned markdown so the model doesn’t mix instructions with content:

```
Extract the data from the following villa listing according to the schema. 
Use only information inside the tags. Convert any EUR prices to USD (approx 1 EUR = 1.08 USD).

<villa_listing>
{{ markdown_content }}
</villa_listing>
```

- System message: high-level role + “one property only”, “ignore cookies/nav/footer”, “no other villas”.
- User message: short instruction + `<villa_listing>…</villa_listing>`.

---

## 3. Pipeline: Crawl → Prune → Extract → Report

| Step   | What happens |
|--------|---------------|
| **Crawl** | Crawl4AI → markdown (existing: `excluded_tags`, `word_count_threshold`, optional dates/guests). |
| **Prune** | `_strip_other_villas_block()` (existing). Optional: more pruning if token cost is an issue. |
| **Extract** | Instructor + Ollama: pass pruned markdown in `<villa_listing>`, `response_model=VillaListing`. Retry on validation error (Instructor can do this). |
| **Parse** | Pydantic validates/coerces; invalid/missing required fields → retry or fallback. |
| **Report** | **Option 1:** Render HTML from the Pydantic model (Jinja2 template with `listing.villa_name`, `listing.price_weekly_usd`, etc.). **Option 2:** Pass the structured object (or a Markdown summary of it) back to the LLM to write the narrative sections; then render that narrative as today. |

Recommendation: **Option 1** first (template from structured data). If you want the same prose style as now, add Option 2 as a second LLM call that takes `VillaListing` (or a KV summary) and outputs the sectioned markdown.

---

## 4. Instructor + Ollama Integration

- Use **Instructor** with Ollama so the model returns JSON that matches your schema; Instructor handles retries and validation.
- **Mode:** `instructor.Mode.JSON` (or tool-calling if your Ollama model supports it).
- **Async:** Keep `generate_villa_page` async; use Instructor’s async client if available, or run the sync Instructor call in `asyncio.to_thread()` so the rest of the app stays async.

Example (sync; you can wrap in `to_thread`):

```python
import instructor
from instructor import Mode

client = instructor.from_provider("ollama/llama3", mode=Mode.JSON)
# Or patch existing ollama client if Instructor supports it

extracted = client.chat.completions.create(
    model="llama3",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Extract...\n<villa_listing>\n{pruned_md}\n</villa_listing>"},
    ],
    response_model=VillaListing,
    max_retries=2,
)
```

---

## 5. Markdown-KV for Complex Tables (Optional)

If seasonal pricing is important and the model struggles with markdown tables:

- Before calling the LLM, detect a “Weekly rates” or “Rates” section and convert table rows to lines like:
  - `period: Jan 3 - March 28, 2026`
  - `price_eur: 5900`
  - `period: June 20 - Aug 29, 2026`
  - `price_eur: 8900`
- Either replace the table in the markdown with this KV block or append it. Then point the schema’s `seasonal_rates` (or similar) at this block.

---

## 6. Implementation Order

1. Add **Pydantic schema** (`VillaListing`) in a small `schema.py` or at top of `scout.py`.
2. Add **Instructor** dependency; wire **Ollama** with `instructor.from_provider("ollama/llama3", mode=Mode.JSON)` (or equivalent async).
3. Change **Extract** step: build system + user message with `<villa_listing>` wrapper, call Instructor with `response_model=VillaListing`, handle validation errors (retry or fallback).
4. **Report**: create a Jinja2 template (or adapt `villa.html`) that renders from `VillaListing` (e.g. sections for location, pricing, amenities, pool, catch). Optionally keep “What we scraped” as before.
5. (Later) Add **seasonal rates** + Markdown-KV if you need them.
6. (Later) Optional second LLM call: `VillaListing` → narrative markdown if you want prose in addition to structured data.

---

## 7. Files to Touch

| File | Change |
|------|--------|
| `scout.py` | Crawl/prune unchanged; replace current Ollama chat with Instructor extraction; pass `VillaListing` into template; optional narrative step. |
| `templates/villa.html` | Accept a `listing` (VillaListing) and optionally `narrative_html`; render sections from `listing.*`. |
| `requirements.txt` | Add `instructor`. |
| New `schema.py` (optional) | Define `VillaListing` (and later `RatePeriod` / `VillaListingWithRates`). |

---

## 8. Open Choices

- **Required vs optional fields:** Making most fields `Optional` avoids hard failures on messy listings; you can then show “—” or “Not stated” in the template. Only make 1–2 fields required (e.g. `villa_name`, `location`) if you want strict validation.
- **Narrative:** Template-only from structured data vs. second LLM call for prose.
- **Async:** Run Instructor in a thread so the FastAPI app stays async, or use Instructor’s async API if available for Ollama.

If you want, next step can be a concrete patch for `scout.py` + a minimal `VillaListing` template wired to this flow.

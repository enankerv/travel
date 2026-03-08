"""LLM-based villa data extraction utilities."""
import asyncio
import logging
import os
import instructor
from schema import VillaListing, FactSheet

log = logging.getLogger("scout.extraction")

# Provider: "gemini" (prod) or "ollama" (local). Defaults to gemini if GEMINI_API_KEY is set.
LLM_PROVIDER = os.getenv("LLM_PROVIDER") or ("gemini" if os.getenv("GEMINI_API_KEY") else "ollama")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3-coder:30b")


def create_extraction_client():
    """Create an instructor client for LLM extraction."""
    if LLM_PROVIDER == "gemini":
        return instructor.from_provider(
            f"google/{GEMINI_MODEL}", mode=instructor.Mode.GENAI_STRUCTURED_OUTPUTS
        )
    return instructor.from_provider(f"ollama/{OLLAMA_MODEL}", mode=instructor.Mode.JSON)


async def extract_fact_sheet(markdown_text: str) -> str:
    """First pass: convert raw markdown into a clean fact sheet."""
    client = create_extraction_client()
    
    stage1_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided text.\n"
        "Find the 'Hard Facts': villa name, location, region, beds, baths, max guests, price range (EUR and USD using 1 EUR ≈ 1.16 USD), security deposit.\n"
        "Identify the 'Soft Facts': The Catch (cons/caveats), short summaries for Interiors, Exteriors, Location, plus amenities, pool features, extras, included/not included.\n"
        "Output ONLY a single structured Markdown fact sheet. Use clear section headings (## Villa Name, ## Location, ## Hard Facts, ## Amenities, ## Summaries, ## Included / Not Included, ## The Catch). "
        "Include only information that appears in the source; do not invent or guess. Do not include any conversational text—only the fact sheet."
    )
    stage1_user = (
        "Convert the following villa listing into a clean, structured Markdown fact sheet. "
        "Use only the content below. Output the fact_sheet field with that Markdown and nothing else.\n\n"
        "<villa_listing>\n" + markdown_text + "\n</villa_listing>"
    )
    
    model = GEMINI_MODEL if LLM_PROVIDER == "gemini" else OLLAMA_MODEL
    result = await asyncio.to_thread(
        client.create,
        model=model,
        messages=[
            {"role": "system", "content": stage1_system},
            {"role": "user", "content": stage1_user},
        ],
        response_model=FactSheet,
        max_retries=2,
    )
    
    fact_sheet = result.fact_sheet or ""
    log.info("fact sheet extracted: %d chars", len(fact_sheet))
    return fact_sheet


async def extract_villa_listing(fact_sheet_markdown: str) -> VillaListing:
    """Second pass: convert fact sheet markdown into structured JSON."""
    client = create_extraction_client()
    
    stage2_system = (
        "You are a professional researcher for Nankervis Digital. Your task is to extract villa data.\n\n"
        "Read the provided Markdown fact sheet.\n"
        "Find the 'Hard Facts' (beds, baths, price, deposit).\n"
        "Identify the 'Soft Facts' (The Catch, summaries, amenities, included/not included).\n"
        "Output ONLY the JSON object with the exact keys requested. Do not include any conversational text. Do not wrap the object in a key like 'properties'."
    )
    stage2_user = (
        "Extract the villa listing into JSON from this fact sheet. Return one object with these exact keys: "
        "villa_name, location, region, max_guests, bedrooms, bathrooms, "
        "price_weekly_min_eur, price_weekly_max_eur, price_weekly_usd, security_deposit_eur, pool_features, amenities, "
        "interiors_summary, exteriors_summary, location_summary, extras, included_in_price, not_included, the_catch. "
        "Use numbers and text from the fact sheet only. If a value is missing, use null or empty list.\n\n"
        "<fact_sheet>\n" + fact_sheet_markdown + "\n</fact_sheet>"
    )
    
    model = GEMINI_MODEL if LLM_PROVIDER == "gemini" else OLLAMA_MODEL
    listing = await asyncio.to_thread(
        client.create,
        model=model,
        messages=[
            {"role": "system", "content": stage2_system},
            {"role": "user", "content": stage2_user},
        ],
        response_model=VillaListing,
        max_retries=2,
    )
    
    try:
        dumped = listing.model_dump()
        filled = {k: v for k, v in dumped.items() if v is not None and v != [] and v != ""}
        log.info("extraction result: %d fields filled: %s", len(filled), list(filled.keys()))
        empty = [k for k, v in dumped.items() if v is None or v == [] or v == ""]
        if empty:
            log.debug("empty fields: %s", empty)
    except Exception as e:
        log.warning("could not log extraction result: %s", e)
    
    return listing


async def extract_villa_two_pass(markdown_text: str) -> VillaListing:
    """Run both extraction passes and return the final VillaListing."""
    print("🧠 Stage 1: Building Fact Sheet (Markdown)...")
    fact_sheet = await extract_fact_sheet(markdown_text)
    
    print("🧠 Stage 2: Extracting JSON from Fact Sheet...")
    listing = await extract_villa_listing(fact_sheet)
    
    return listing

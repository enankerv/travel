"""Pydantic schema for villa listing extraction. Fields are forgiving (Any) during extraction; model_validator coerces before use."""
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any
import re


class FactSheet(BaseModel):
    """Stage 1 output: a single structured Markdown fact sheet for one villa."""
    fact_sheet: str = Field(description="Structured Markdown with sections: Villa Name, Location, Hard Facts (beds, baths, price), Amenities, Summaries (interiors, exteriors, location), Included/Not Included, The Catch. Use only information from the source text.")


# Basic list of Italian regions to sanity-check the `region` field
ITALIAN_REGIONS = {
    "Abruzzo",
    "Aosta Valley",
    "Apulia",
    "Basilicata",
    "Calabria",
    "Campania",
    "Emilia-Romagna",
    "Friuli Venezia Giulia",
    "Lazio",
    "Liguria",
    "Lombardy",
    "Marche",
    "Molise",
    "Piedmont",
    "Sardinia",
    "Sicily",
    "Trentino-Alto Adige",
    "Tuscany",
    "Umbria",
    "Veneto",
}
_ITALIAN_REGIONS_LOWER = {r.lower() for r in ITALIAN_REGIONS}


def _coerce_eur_value(v: Any) -> Optional[float]:
    """Extract numeric value from string like '800 €', 'Approx 500 Euro', or list."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, list):
        v = v[0] if v else None
    if isinstance(v, str):
        m = re.search(r"[\d.,]+", v.replace(",", ""))
        return float(m.group()) if m else None
    return None


def _coerce_int_value(v: Any) -> Optional[int]:
    """Extract integer from string, float, or list."""
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v) if not (v != v) else None  # exclude NaN
    if isinstance(v, list):
        v = v[0] if v else None
    if isinstance(v, str):
        m = re.search(r"\d+", v)
        return int(m.group()) if m else None
    return None


def _coerce_str_or_list_to_str(v: Any) -> Optional[str]:
    """Accept string or list of strings; return single string."""
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip() or None
    if isinstance(v, list):
        return " ".join(str(x).strip() for x in v if x).strip() or None
    return str(v).strip() or None


def _coerce_to_list(v: Any, *, split_on: str = r"[;\n]+") -> List[str]:
    """Accept string (split on ; or newline), list, or single value; return list of non-empty strings."""
    if v is None:
        return []
    if isinstance(v, list):
        out = []
        for x in v:
            if isinstance(x, str):
                out.extend(s.strip() for s in re.split(split_on, x) if s.strip())
            elif x is not None and x != "":
                out.append(str(x).strip())
        return out
    if isinstance(v, str):
        return [s.strip() for s in re.split(split_on, v) if s.strip()]
    return [str(v).strip()] if str(v).strip() else []


class VillaListing(BaseModel):
    """Catch-all types during extraction; model_validator coerces to final types."""
    villa_name: Optional[Any] = Field(default=None, description="The official name of the property")
    location: Optional[Any] = Field(default=None, description="Town or locality in Italy (e.g. Cetona, Montegufoni)")
    region: Optional[Any] = Field(default=None, description="Italian region only if distinct from location (e.g. Tuscany)")
    max_guests: Optional[Any] = Field(default=None, description="Maximum number of guests")
    bedrooms: Optional[Any] = Field(default=None, description="Total number of bedrooms")
    bathrooms: Optional[Any] = Field(default=None, description="Total number of bathrooms")
    price_weekly_min_eur: Optional[Any] = Field(default=None, description="Lowest weekly rate in EUR")
    price_weekly_max_eur: Optional[Any] = Field(default=None, description="Highest weekly rate in EUR")
    price_weekly_usd: Optional[Any] = Field(default=None, description="Weekly price range in USD, e.g. '~$6,400–9,600 USD/week'")
    security_deposit_eur: Optional[Any] = Field(default=None, description="Any mention of a security deposit (amount in EUR)")
    pool_features: Optional[Any] = Field(default=None, description="Pool details: infinity, heated, dimensions, etc.")
    amenities: Optional[Any] = Field(default=None, description="Key features: AC, WiFi, kitchen, BBQ, etc.")
    interiors_summary: Optional[Any] = Field(default=None, description="Short summary of layout and rooms")
    exteriors_summary: Optional[Any] = Field(default=None, description="Short summary of garden, terraces, views")
    location_summary: Optional[Any] = Field(default=None, description="Nearby towns, motorway exit, driving times")
    extras: Optional[Any] = Field(default=None, description="Extras: chef, tours, winetasting, etc.")
    included_in_price: Optional[Any] = Field(default=None, description="What is included (linen, cleaning, etc.)")
    not_included: Optional[Any] = Field(default=None, description="What is not included (final cleaning, heating, etc.)")
    the_catch: Optional[Any] = Field(default=None, description="Cons or caveats (steps, gravel road, no pets, etc.)")

    @model_validator(mode="before")
    @classmethod
    def unwrap_and_normalize(cls, data: Any) -> Any:
        """Unwrap wrappers, map alternate keys, and coerce all Any fields to proper types."""
        if not isinstance(data, dict):
            return data
        # Unwrap single-key "properties" wrapper
        if list(data.keys()) == ["properties"] and isinstance(data.get("properties"), dict):
            data = {**data["properties"]}
        # Map common LLM key names to schema fields
        if "property" in data and data.get("villa_name") is None:
            data = {**data, "villa_name": data["property"]}

        # Coerce each field so validation never fails on "Approx 500 Euro" etc.
        data = {**data, "villa_name": _coerce_str_or_list_to_str(data.get("villa_name")) or ""}
        data = {**data, "location": _coerce_str_or_list_to_str(data.get("location")) or ""}
        data = {**data, "region": _coerce_str_or_list_to_str(data.get("region"))}
        data = {**data, "max_guests": _coerce_int_value(data.get("max_guests"))}
        data = {**data, "bedrooms": _coerce_int_value(data.get("bedrooms"))}
        data = {**data, "bathrooms": _coerce_int_value(data.get("bathrooms"))}
        data = {**data, "price_weekly_min_eur": _coerce_eur_value(data.get("price_weekly_min_eur"))}
        data = {**data, "price_weekly_max_eur": _coerce_eur_value(data.get("price_weekly_max_eur"))}
        data = {**data, "price_weekly_usd": _coerce_eur_value(data.get("price_weekly_usd"))}
        data = {**data, "security_deposit_eur": _coerce_eur_value(data.get("security_deposit_eur"))}
        data = {**data, "pool_features": _coerce_to_list(data.get("pool_features"))}
        data = {**data, "amenities": _coerce_to_list(data.get("amenities"))}
        data = {**data, "interiors_summary": _coerce_str_or_list_to_str(data.get("interiors_summary"))}
        data = {**data, "exteriors_summary": _coerce_str_or_list_to_str(data.get("exteriors_summary"))}
        data = {**data, "location_summary": _coerce_str_or_list_to_str(data.get("location_summary"))}
        data = {**data, "extras": _coerce_to_list(data.get("extras"))}
        data = {**data, "included_in_price": _coerce_to_list(data.get("included_in_price"))}
        data = {**data, "not_included": _coerce_to_list(data.get("not_included"))}
        data = {**data, "the_catch": _coerce_str_or_list_to_str(data.get("the_catch"))}

        # Sanity-check region: enforce Italian region names only
        if data.get("region"):
            r = str(data["region"]).strip()
            if r.lower() not in _ITALIAN_REGIONS_LOWER:
                data = {**data, "region": None}
            else:
                data = {**data, "region": r}
        return data

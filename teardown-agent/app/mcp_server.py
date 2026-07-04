import json
import os
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Cost Database")

# Mock database of manufacturing costs for common engineering materials
COSTS = {
    "abs": {"price_per_kg": "$3.50", "complexity_premium": "low"},
    "aluminum": {"price_per_kg": "$6.20", "complexity_premium": "medium"},
    "steel": {"price_per_kg": "$2.10", "complexity_premium": "low"},
    "copper": {"price_per_kg": "$9.80", "complexity_premium": "high"},
    "silicon": {"price_per_kg": "$25.00", "complexity_premium": "high"},
    "fr4": {"price_per_kg": "$12.00", "complexity_premium": "medium"},
    "carbon fiber": {"price_per_kg": "$45.00", "complexity_premium": "high"},
    "nylon": {"price_per_kg": "$4.50", "complexity_premium": "medium"},
    "polycarbonate": {"price_per_kg": "$4.20", "complexity_premium": "medium"},
    "titanium": {"price_per_kg": "$35.00", "complexity_premium": "high"},
    "brass": {"price_per_kg": "$8.50", "complexity_premium": "medium"},
    "rubber": {"price_per_kg": "$3.00", "complexity_premium": "low"},
    "glass": {"price_per_kg": "$5.00", "complexity_premium": "medium"},
    "petg": {"price_per_kg": "$3.80", "complexity_premium": "low"},
    "pla": {"price_per_kg": "$2.50", "complexity_premium": "low"},
    "acrylic": {"price_per_kg": "$4.00", "complexity_premium": "low"},
    "epoxy": {"price_per_kg": "$15.00", "complexity_premium": "medium"},
    "ceramic": {"price_per_kg": "$18.00", "complexity_premium": "high"},
    "gold": {"price_per_kg": "$65000.00", "complexity_premium": "high"},
    "silver": {"price_per_kg": "$800.00", "complexity_premium": "high"}
}

@mcp.tool()
def get_materials_costs(materials: list[str]) -> dict:
    """Look up current manufacturing costs for a list of materials in batch.

    Args:
        materials: A list of material names to query.
    """
    results = {}
    for material in materials:
        mat = material.lower().strip()
        results[material] = COSTS.get(mat, {"price_per_kg": "Unknown / Custom", "complexity_premium": "high"})
    return results

if __name__ == "__main__":
    mcp.run()

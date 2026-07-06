import os
import sys
import logging

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.mcp_server import search_parts_costs, get_materials_costs

def test_mcp_tools():
    print("=== Testing MCP Tools ===")
    
    # 1. Test raw materials cost lookup (static database)
    print("\n--- Testing get_materials_costs ---")
    materials = ["ABS", "aluminum", "unknown_material"]
    materials_result = get_materials_costs(materials)
    print(f"Input: {materials}")
    print(f"Output:\n{materials_result}")
    
    # Check assertions
    assert "ABS" in materials_result
    assert "aluminum" in materials_result
    assert materials_result["ABS"]["price_per_kg"] == "$3.50"
    assert materials_result["unknown_material"]["price_per_kg"] == "Unknown / Custom"
    print("get_materials_costs test PASSED.")

    # 2. Test parts cost search
    print("\n--- Testing search_parts_costs ---")
    parts = ["stm32", "bldc motor", "custom_part"]
    parts_result = search_parts_costs(parts)
    print(f"Input: {parts}")
    
    # Format and print output
    for query, res in parts_result.items():
        print(f"\nQuery: {query}")
        print(f"  Status: {res.get('status')}")
        print(f"  Source: {res.get('source')}")
        if res.get("status") == "success":
            for part in res.get("data", []):
                print(f"  Part: {part.get('mpn')} ({part.get('manufacturer')})")
                print(f"    Desc: {part.get('description')}")
                if "web_snippets" in part:
                    print("    Web Snippets:")
                    for snippet in part["web_snippets"]:
                        safe_title = snippet.get('title', '').encode('ascii', errors='replace').decode('ascii')
                        safe_body = snippet.get('snippet', '')[:100].encode('ascii', errors='replace').decode('ascii')
                        print(f"      - Title: {safe_title}")
                        print(f"        Snippet: {safe_body}...")
                        print(f"        URL: {snippet.get('url')}")

                for offer in part.get("offers", []):
                    print(f"    Seller: {offer.get('seller')}, Inventory: {offer.get('inventory')}")
                    print(f"      Prices: {offer.get('prices')}")
        else:
            print(f"  Error: {res.get('message')}")
            
    # Check assertions
    assert "stm32" in parts_result
    assert "bldc motor" in parts_result
    assert parts_result["stm32"]["status"] == "success"
    print("\nsearch_parts_costs test PASSED.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        test_mcp_tools()
        print("\nAll tests completed successfully!")
    except Exception as e:
        print(f"\nTest FAILED: {e}")
        sys.exit(1)

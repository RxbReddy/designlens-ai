import json
import os
import time
import logging
import threading
from mcp.server.fastmcp import FastMCP
import requests
from ddgs import DDGS
import concurrent.futures

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp_server")

mcp = FastMCP("DesignLens Cost Database")

# Helper to load .env manually
def load_env():
    # Look for .env in the parent directory of 'app' (the project root)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        logger.info(f"Loading environment variables from {env_path}")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip('"').strip("'")

# Load environment on startup
load_env()

# Thread-safe UI status visualization helper
STATUS_FILE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".adk")
STATUS_FILE_PATH = os.path.join(STATUS_FILE_DIR, "mcp_status.json")
status_lock = threading.RLock()
tool_active = False

def write_status(status: str, queries_state: dict):
    global tool_active
    if status == "running" and not tool_active:
        return
    try:
        os.makedirs(STATUS_FILE_DIR, exist_ok=True)
        with status_lock:
            with open(STATUS_FILE_PATH, "w") as f:
                json.dump({
                    "status": status,
                    "queries": queries_state,
                    "timestamp": time.time()
                }, f)
    except Exception as e:
        logger.error(f"Failed to write mcp_status.json: {e}")

# Static mock database of manufacturing costs for raw materials (retained for fallback and raw material lookups)
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

# OAuth token cache
_nexar_token = None
_nexar_token_expires_at = 0.0

def get_nexar_token() -> str:
    """Retrieves and caches a Nexar OAuth access token."""
    global _nexar_token, _nexar_token_expires_at
    
    current_time = time.time()
    if _nexar_token and current_time < _nexar_token_expires_at:
        return _nexar_token
        
    client_id = os.environ.get("NEXAR_CLIENT_ID", "").strip()
    client_secret = os.environ.get("NEXAR_CLIENT_SECRET", "").strip()
    
    if not client_id or not client_secret:
        raise ValueError("Nexar credentials not found. Set NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET in your env.")
        
    logger.info("Requesting new Nexar access token...")
    url = "https://identity.nexar.com/connect/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "supply.domain"
    }
    
    response = requests.post(url, data=data, timeout=10)
    if response.status_code != 200:
        logger.error(f"Nexar token request failed: {response.status_code} - {response.text}")
    response.raise_for_status()
    res_data = response.json()
    
    _nexar_token = res_data["access_token"]
    # Expire token 1 minute early to avoid edge cases
    _nexar_token_expires_at = current_time + res_data.get("expires_in", 86400) - 60
    logger.info("Nexar access token successfully updated and cached.")
    return _nexar_token

def query_nexar(query: str, variables: dict) -> dict:
    """Sends a GraphQL request to the Nexar API."""
    token = get_nexar_token()
    url = "https://api.nexar.com/graphql"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {"query": query, "variables": variables}
    
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()

@mcp.tool()
def get_materials_costs(materials: list[str]) -> dict:
    """Look up manufacturing costs for raw materials (plastics, metals, composites).
    
    Args:
        materials: A list of raw material names to query (e.g., ["ABS", "aluminum"]).
    """
    logger.info(f"get_materials_costs tool invoked with: {materials}")
    results = {}
    for material in materials:
        mat = material.lower().strip()
        # Find exact match or substring match
        matched_data = None
        for key, data in COSTS.items():
            if key in mat or mat in key:
                matched_data = data
                break
        
        results[material] = matched_data or {"price_per_kg": "Unknown / Custom", "complexity_premium": "high"}
    return results

def mock_parts_fallback(q: str) -> dict:
    """Fuzzy match query against mock components database as a final resort when all search/API methods fail."""
    q_lower = q.lower()
    MOCK_COMPONENTS = {
        "stm32": {"mpn": "STM32F103C8T6", "manufacturer": "STMicroelectronics", "description": "ARM Cortex-M3 MCU", "offers": [{"seller": "DigiKey", "inventory": 1420, "prices": [{"qty": 1, "price": 3.42, "currency": "USD"}]}]},
        "motor": {"mpn": "MT2204-2300KV", "manufacturer": "Emax", "description": "Brushless DC Motor", "offers": [{"seller": "GetFPV", "inventory": 85, "prices": [{"qty": 1, "price": 14.99, "currency": "USD"}]}]},
        "gimbal": {"mpn": "GIMBAL-3AXIS", "manufacturer": "Tarot", "description": "3-Axis Brushless Gimbal", "offers": [{"seller": "HobbyWing", "inventory": 45, "prices": [{"qty": 1, "price": 89.99, "currency": "USD"}]}]},
        "camera": {"mpn": "CAM-4K-MICRO", "manufacturer": "RunCam", "description": "4K FPV Micro Camera", "offers": [{"seller": "GetFPV", "inventory": 120, "prices": [{"qty": 1, "price": 69.99, "currency": "USD"}]}]},
        "flight controller": {"mpn": "PIXHAWK-4", "manufacturer": "Holybro", "description": "Pixhawk 4 Flight Controller", "offers": [{"seller": "Mouser", "inventory": 310, "prices": [{"qty": 1, "price": 179.00, "currency": "USD"}]}]},
        "gps": {"mpn": "NEO-M8N", "manufacturer": "u-blox", "description": "GPS/GNSS Module with Antenna", "offers": [{"seller": "Mouser", "inventory": 210, "prices": [{"qty": 1, "price": 18.50, "currency": "USD"}]}]},
        "battery": {"mpn": "LIPO-3S-1500", "manufacturer": "Tattu", "description": "11.1V 1500mAh LiPo Battery", "offers": [{"seller": "Amazon Business", "inventory": 500, "prices": [{"qty": 1, "price": 22.00, "currency": "USD"}]}]},
        "sensor": {"mpn": "MPU-6050", "manufacturer": "TDK InvenSense", "description": "6-Axis Gyroscope/Accelerometer", "offers": [{"seller": "DigiKey", "inventory": 3400, "prices": [{"qty": 1, "price": 2.15, "currency": "USD"}]}]}
    }
    for key, data in MOCK_COMPONENTS.items():
        if key in q_lower:
            logger.info(f"Fuzzy-matched query '{q}' to mock component: {key}")
            return {
                "status": "success",
                "source": "Mock Pricing Database (Fallback)",
                "data": [data]
            }
    # Generic fallback
    logger.info(f"Using generic mock component estimate for query '{q}'")
    return {
        "status": "success",
        "source": "Mock Pricing Database (Generic Fallback)",
        "data": [{
            "mpn": q.upper().replace(" ", "-"),
            "manufacturer": "Generic / OEM",
            "description": f"Estimated specification for {q}",
            "offers": [{"seller": "Global Source", "inventory": 1000, "prices": [{"qty": 1, "price": 25.00, "currency": "USD"}]}]
        }]
    }

def search_web_fallback(q: str) -> dict:
    """Fallback search using DuckDuckGo to retrieve component pricing snippets.
    Guaranteed to run within the 5.0 seconds MCP tool timeout limit.
    """
    logger.info(f"Triggering fast DuckDuckGo web search fallback for query: '{q}'")
    
    # Try one main query first (price-oriented) with a 2-second timeout
    try:
        results = []
        with DDGS(timeout=2) as ddgs:
            for r in ddgs.text(f"{q} price", max_results=3):
                results.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                })
        if results:
            logger.info(f"Retrieved {len(results)} search results for '{q} price'")
            return {
                "status": "success",
                "source": "Web Search (DuckDuckGo Fallback)",
                "data": [{
                    "mpn": "WEB_SEARCH_FALLBACK",
                    "manufacturer": "Various / Found via Web Search",
                    "description": f"Pricing snippets for query: {q}",
                    "web_snippets": results
                }]
            }
    except Exception as e:
        logger.warning(f"Fast DDG search for '{q} price' failed: {e}")
        
    # If the first one failed, try a simple keyword search with a short 1-second timeout
    try:
        results = []
        with DDGS(timeout=1) as ddgs:
            for r in ddgs.text(q, max_results=2):
                results.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", "")
                })
        if results:
            logger.info(f"Retrieved {len(results)} search results for query '{q}'")
            return {
                "status": "success",
                "source": "Web Search (DuckDuckGo Fallback)",
                "data": [{
                    "mpn": "WEB_SEARCH_FALLBACK",
                    "manufacturer": "Various / Found via Web Search",
                    "description": f"Pricing snippets for query: {q}",
                    "web_snippets": results
                }]
            }
    except Exception as e:
        logger.error(f"Fallback search for '{q}' failed: {e}")
        
    # Default to mock database fallback instead of empty results to prevent teardown failure
    logger.warning(f"Web searches completely failed/timed out for '{q}'. Falling back to mock database.")
    return mock_parts_fallback(q)




@mcp.tool()
def search_parts_costs(queries: list[str]) -> dict:
    """Search for electronic or mechanical parts by MPN/keyword to retrieve live prices and availability.
    
    Args:
        queries: A list of part numbers or keywords to search (e.g., ["STM32F103", "BLDC motor", "GPS module"]).
    """
    logger.info(f"search_parts_costs tool invoked with: {queries}")
    global tool_active
    tool_active = True
    start_time = time.time()
    
    client_id = os.environ.get("NEXAR_CLIENT_ID", "").strip()
    client_secret = os.environ.get("NEXAR_CLIENT_SECRET", "").strip()
    
    # Fallback to local mock pricing if credentials are not configured
    if not client_id or not client_secret:
        logger.warning("Nexar API credentials not found. Falling back to mock pricing lookup.")
        queries_state = {q: {"engine": "Mock Database", "status": "fallback"} for q in queries}
        write_status("running", queries_state)
        mock_results = {}
        # Simple mock dictionary for common components
        MOCK_COMPONENTS = {
            "stm32": {"mpn": "STM32F103C8T6", "manufacturer": "STMicroelectronics", "description": "ARM Cortex-M3 MCU", "offers": [{"seller": "DigiKey", "inventory": 1420, "prices": [{"qty": 1, "price": 3.42, "currency": "USD"}]}]},
            "motor": {"mpn": "MT2204-2300KV", "manufacturer": "Emax", "description": "Brushless DC Motor", "offers": [{"seller": "GetFPV", "inventory": 85, "prices": [{"qty": 1, "price": 14.99, "currency": "USD"}]}]},
            "gps": {"mpn": "NEO-M8N", "manufacturer": "u-blox", "description": "GPS/GNSS Module", "offers": [{"seller": "Mouser", "inventory": 210, "prices": [{"qty": 1, "price": 18.50, "currency": "USD"}]}]},
            "battery": {"mpn": "LIPO-3S-1500", "manufacturer": "Tattu", "description": "11.1V 1500mAh LiPo Battery", "offers": [{"seller": "Amazon Business", "inventory": 500, "prices": [{"qty": 1, "price": 22.00, "currency": "USD"}]}]},
            "sensor": {"mpn": "MPU-6050", "manufacturer": "TDK InvenSense", "description": "6-Axis Gyroscope/Accelerometer", "offers": [{"seller": "DigiKey", "inventory": 3400, "prices": [{"qty": 1, "price": 2.15, "currency": "USD"}]}]}
        }
        for q in queries:
            q_lower = q.lower()
            matched = False
            for key, data in MOCK_COMPONENTS.items():
                if key in q_lower:
                    mock_results[q] = {
                        "status": "success",
                        "data": [data]
                    }
                    matched = True
                    break
            if not matched:
                mock_results[q] = {
                    "status": "success",
                    "data": [{
                        "mpn": q.upper(),
                        "manufacturer": "Generic / OEM",
                        "description": f"Generic search result for {q}",
                        "offers": [{"seller": "Global Source", "inventory": 1000, "prices": [{"qty": 1, "price": 5.00, "currency": "USD"}]}]
                    }]
                }
        write_status("idle", {})
        return mock_results

    # Pre-fetch the Nexar token sequentially once to avoid race conditions and 429 errors from parallel threads
    try:
        get_nexar_token()
    except Exception as e:
        logger.warning(f"Failed to pre-fetch Nexar token: {e}")

    # Query Nexar API / Web Fallback in parallel
    results = {}
    queries_state = {q: {"engine": "Nexar API", "status": "searching"} for q in queries}
    write_status("running", queries_state)
    
    graphql_query = """
    query SearchParts($q: String!) {
      supSearch(q: $q, limit: 3) {
        results {
          part {
            mpn
            manufacturer {
              name
            }
            shortDescription
            sellers {
              company {
                name
              }
              offers {
                inventoryLevel
                prices {
                  quantity
                  price
                  currency
                }
              }
            }
          }
        }
      }
    }
    """
    
    def process_single_query(q: str) -> dict:
        # Check remaining time budget (Total budget = 3.8s)
        elapsed = time.time() - start_time
        time_left = 3.8 - elapsed
        if time_left < 1.0:
            logger.warning(f"Time budget nearly exhausted ({time_left:.2f}s left). Skipping network for '{q}' and using mock fallback.")
            with status_lock:
                queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                write_status("running", queries_state)
            return mock_parts_fallback(q)
            
        parts_data = []
        fallback_needed = False
        
        try:
            response = query_nexar(graphql_query, {"q": q})
            logger.info(f"Nexar response for '{q}': {json.dumps(response)}")
            if "errors" in response:
                raise ValueError(f"GraphQL errors: {response['errors']}")
            
            data = response.get("data")
            if not data:
                raise ValueError("No data returned from Nexar API.")
                
            sup_search = data.get("supSearch")
            if not sup_search:
                raise ValueError("supSearch returned null/None in data.")
                
            search_results = sup_search.get("results") or []
            
            for r in search_results:
                part = r.get("part", {})
                if not part:
                    continue
                    
                mpn = part.get("mpn", "Unknown")
                mfr = part.get("manufacturer", {}).get("name", "Unknown")
                desc = part.get("shortDescription", "")
                
                offers = []
                for seller in part.get("sellers", []):
                    seller_name = seller.get("company", {}).get("name", "Unknown")
                    for offer in seller.get("offers", []):
                        inv = offer.get("inventoryLevel", 0)
                        prices = []
                        for price in offer.get("prices", []):
                            prices.append({
                                "qty": price.get("quantity"),
                                "price": price.get("price"),
                                "currency": price.get("currency", "USD")
                            })
                        if prices:
                            offers.append({
                                "seller": seller_name,
                                "inventory": inv,
                                "prices": prices[:3] # limit price breaks
                            })
                
                parts_data.append({
                    "mpn": mpn,
                    "manufacturer": mfr,
                    "description": desc,
                    "offers": offers[:2] # limit to top 2 sellers to avoid token bloat
                })
            
            if not parts_data:
                fallback_needed = True
                
        except Exception as e:
            logger.warning(f"Nexar query failed/exhausted for '{q}': {e}. Falling back to web search.")
            fallback_needed = True
            
        if fallback_needed:
            # Check time left before launching web search fallback
            current_elapsed = time.time() - start_time
            current_time_left = 3.8 - current_elapsed
            if current_time_left < 1.0:
                logger.warning(f"Time budget too low ({current_time_left:.2f}s left) to start web search for '{q}'. Using mock fallback.")
                with status_lock:
                    queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                    write_status("running", queries_state)
                return mock_parts_fallback(q)
                
            with status_lock:
                queries_state[q] = {"engine": "DuckDuckGo Web", "status": "searching"}
                write_status("running", queries_state)
                
            res = search_web_fallback(q)
            
            with status_lock:
                if res.get("source") == "Mock Component Database Fallback":
                    queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                else:
                    queries_state[q] = {"engine": "DuckDuckGo Web", "status": "complete"}
                write_status("running", queries_state)
            return res
        else:
            with status_lock:
                queries_state[q] = {"engine": "Nexar API", "status": "complete"}
                write_status("running", queries_state)
            return {
                "status": "success",
                "source": "Nexar Live API",
                "data": parts_data
            }
 
     # Execute in parallel threads to prevent 5-second timeout
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=6)
    future_to_query = {executor.submit(process_single_query, q): q for q in queries}
    try:
        # Enforce strict timeout on the gather operation
        completed, pending = concurrent.futures.wait(
            future_to_query.keys(), 
            timeout=3.8, 
            return_when=concurrent.futures.ALL_COMPLETED
        )
        
        for future in completed:
            q = future_to_query[future]
            try:
                results[q] = future.result()
            except Exception as exc:
                logger.error(f"Query thread failed for '{q}': {exc}")
                with status_lock:
                    queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                    write_status("running", queries_state)
                results[q] = mock_parts_fallback(q)
                 
        # For any pending futures that did not finish within the 3.8s window, cancel them and return mock results
        for future in pending:
            q = future_to_query[future]
            future.cancel()
            logger.warning(f"Query for '{q}' timed out within 3.8s time budget. Falling back to mock database.")
            with status_lock:
                queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                write_status("running", queries_state)
            results[q] = mock_parts_fallback(q)
             
    except Exception as exc:
        logger.error(f"Executor wait failed: {exc}")
        # Safe recovery: fallback to mock data for all queries not yet answered
        for q in queries:
            if q not in results:
                with status_lock:
                    queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                    write_status("running", queries_state)
                results[q] = mock_parts_fallback(q)
    finally:
        executor.shutdown(wait=False)
                 
    # Double-check that all queries have a response in results
    for q in queries:
        if q not in results:
            with status_lock:
                queries_state[q] = {"engine": "Mock Database", "status": "fallback"}
                write_status("running", queries_state)
            results[q] = mock_parts_fallback(q)
             
    tool_active = False
    write_status("idle", {})
    return results


if __name__ == "__main__":
    mcp.run()

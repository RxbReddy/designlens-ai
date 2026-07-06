import logging
from ddgs import DDGS

logging.basicConfig(level=logging.INFO)

def test():
    print("=== Testing DDGS ===")
    try:
            import inspect
            with DDGS() as ddgs:
                print("DDGS.text signature:", inspect.signature(ddgs.text))




    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test()

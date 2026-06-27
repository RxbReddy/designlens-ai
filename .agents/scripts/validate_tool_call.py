import sys
import json
import re

def main():
    try:
        raw_payload = sys.stdin.read()
        if not raw_payload.strip():
            sys.exit(0)

        payload = json.loads(raw_payload)
        payload_str = json.dumps(payload)

        # Define dangerous patterns to block
        dangerous_patterns = [
            r"rm\s+-rf\s+/",
            r"rm\s+-rf\s+\*",
            r"rm\s+-rf\s+\.agents",
            r"rm\s+-rf\s+docs",
            r"rm\s+-rf\s+teardown-agent",
            r"rm\s+-rf\s+\$HOME",
            r"rm\s+-rf\s+~"
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, payload_str):
                print(f"ERROR: Dangerous command pattern detected matching {pattern}", file=sys.stderr)
                sys.exit(2)

        # Inspect specific CommandLine arguments
        args = payload.get("args", {})
        cmd = args.get("CommandLine", "") or payload.get("CommandLine", "")
        if cmd:
            for pattern in dangerous_patterns:
                if re.search(pattern, cmd):
                    print(f"ERROR: Dangerous command detected: {cmd}", file=sys.stderr)
                    sys.exit(2)

        sys.exit(0)
    except Exception as e:
        print(f"Hook warning: {e}", file=sys.stderr)
        sys.exit(0)

if __name__ == "__main__":
    main()

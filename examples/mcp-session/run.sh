#!/bin/sh
# One MCP session against a running barrel_server, with curl.
#   BARREL_URL (default http://localhost:8080)
#   BARREL_TOKEN (optional bearer, for a server with auth)
# Needs curl and jq.
set -eu
URL="${BARREL_URL:-http://localhost:8080}"
DB=mcp_demo
HDRS=$(mktemp)
trap 'rm -f "$HDRS"' EXIT
AUTH=""
[ -n "${BARREL_TOKEN:-}" ] && AUTH="authorization: Bearer $BARREL_TOKEN"

# post <json>: POST one JSON-RPC message to /mcp, print the body.
# tools/call answers as SSE ("data: {...}"): keep the JSON.
post() {
  curl -sS -D "$HDRS" -X POST "$URL/mcp" \
    -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' \
    -H 'mcp-protocol-version: 2025-06-18' \
    ${SID:+-H "mcp-session-id: $SID"} \
    ${AUTH:+-H "$AUTH"} \
    -d "$1" | awk '/^data: /{print substr($0, 7); next} /^\{/'
}

# call <id> <tool> <arguments>: print the request, then the tool
# result (a JSON document in the text content).
call() {
  req="{\"jsonrpc\":\"2.0\",\"id\":$1,\"method\":\"tools/call\","
  req="$req\"params\":{\"name\":\"$2\",\"arguments\":$3}}"
  echo "--> $req"
  post "$req" | jq '{isError: (.result.isError // false),
                     result: (.result.content[0].text | fromjson)}'
  echo
}

# Start from an empty database (REST, outside MCP).
curl -sS -o /dev/null -X DELETE ${AUTH:+-H "$AUTH"} \
  "$URL/db/$DB?purge=true" || true

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
echo "--> $INIT"
SID=""
post "$INIT" | jq -c '.result | {protocolVersion, serverInfo}'
SID=$(tr -d '\r' < "$HDRS" | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}')
echo "mcp-session-id: $SID"
echo

echo '--> {"jsonrpc":"2.0","method":"notifications/initialized"}'
post '{"jsonrpc":"2.0","method":"notifications/initialized"}'
sed -n '1s/\r$//p' "$HDRS"
echo

echo '--> {"jsonrpc":"2.0","id":2,"method":"tools/list"}'
post '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | jq -r '"\(.result.tools | length) tools:",
           (.result.tools | map(.name) as $n
            | range(0; $n | length; 4) | $n[.:. + 4] | join(", "))'
echo

call 3 db_create "{\"db\":\"$DB\"}"
call 4 doc_put "{\"db\":\"$DB\",\"doc\":{\"id\":\"note-1\",\"title\":\"stored over MCP\",\"tags\":[\"mcp\"]}}"
call 5 doc_put "{\"db\":\"$DB\",\"doc\":{\"id\":\"note-2\",\"title\":\"release checklist\",\"tags\":[\"ops\"]}}"
call 6 doc_get "{\"db\":\"$DB\",\"id\":\"note-1\"}"
call 7 query "{\"db\":\"$DB\",\"query\":\"SELECT id, title FROM c WHERE 'ops' IN tags LIMIT 5\"}"
call 8 ngram_search "{\"db\":\"$DB\",\"query\":\"over MCP\"}"
call 9 doc_get "{\"db\":\"$DB\",\"id\":\"missing\"}"

echo "--> DELETE /mcp"
curl -sS -o /dev/null -w '%{http_code}\n' -X DELETE "$URL/mcp" \
  -H "mcp-session-id: $SID" ${AUTH:+-H "$AUTH"}
